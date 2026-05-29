/*
 * Wimcord — main-process diagnostics file logging
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { app, ipcMain } from "electron";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

import { DATA_DIR } from "./utils/constants";

const LOG_DIR = join(DATA_DIR, "wimcord-logs");
const LOG_FILE = join(LOG_DIR, "diagnostics.log");
const MAX_LOG_BYTES = 8 * 1024 * 1024;
const MAX_READ_LINES = 5000;
const TRIM_KEEP_LINES = 4000;

const mainSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function ensureLogDir() {
    try {
        mkdirSync(LOG_DIR, { recursive: true });
    } catch { /* ignore */ }
}

function maybeTrimLogFile() {
    try {
        if (!existsSync(LOG_FILE)) return;
        const { size } = statSync(LOG_FILE);
        if (size <= MAX_LOG_BYTES) return;

        const content = readFileSync(LOG_FILE, "utf-8");
        const lines = content.split("\n").filter(Boolean);
        writeFileSync(LOG_FILE, lines.slice(-TRIM_KEEP_LINES).join("\n") + "\n", "utf-8");
    } catch { /* ignore */ }
}

function appendRecord(record: Record<string, unknown>) {
    ensureLogDir();
    maybeTrimLogFile();
    const line = JSON.stringify({
        ts: Date.now(),
        sessionId: mainSessionId,
        source: "main",
        ...record,
    });
    appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

function writeLine(line: string) {
    ensureLogDir();
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(line);
    } catch {
        payload = { message: line, kind: "raw" };
    }

    maybeTrimLogFile();
    appendFileSync(
        LOG_FILE,
        JSON.stringify({
            ts: typeof payload.ts === "number" ? payload.ts : Date.now(),
            sessionId: typeof payload.sessionId === "string" ? payload.sessionId : mainSessionId,
            source: payload.source ?? "renderer",
            ...payload,
        }) + "\n",
        "utf-8"
    );
}

function captureMainSnapshot(extra?: Record<string, unknown>) {
    return {
        pid: process.pid,
        ppid: process.ppid,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        v8: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
        execPath: process.execPath,
        cwd: process.cwd(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        ...extra,
    };
}

export function initWimcordMainDiagnostics() {
    ensureLogDir();

    appendRecord({
        kind: "boot",
        level: "info",
        message: "Main process started",
        detail: captureMainSnapshot({
            userData: app.getPath?.("userData"),
            appVersion: app.getVersion?.(),
            isPackaged: app.isPackaged,
            argv: process.argv.slice(0, 8),
        }),
    });

    app.on("render-process-gone", (_e, webContents, details) => {
        appendRecord({
            kind: "render-process-gone",
            level: "critical",
            message: `Renderer died: ${details.reason}`,
            detail: {
                ...captureMainSnapshot(),
                exitCode: details.exitCode,
                reason: details.reason,
                url: webContents.getURL(),
                title: webContents.getTitle?.(),
                osProcessId: webContents.getOSProcessId?.(),
            },
        });
        console.error("[Wimcord] render-process-gone", details);
    });

    app.on("child-process-gone", (_e, details) => {
        appendRecord({
            kind: "child-process-gone",
            level: "critical",
            message: `Child process gone: ${details.type} / ${details.reason}`,
            detail: {
                ...captureMainSnapshot(),
                ...details,
            },
        });
    });

    app.on("gpu-process-crashed", (_e, killed) => {
        appendRecord({
            kind: "gpu-process-crashed",
            level: "critical",
            message: `GPU process crashed (killed=${killed})`,
            detail: captureMainSnapshot({ killed }),
        });
    });

    app.on("web-contents-created", (_e, webContents) => {
        const wcId = webContents.id;

        webContents.on("crashed", (_event, killed) => {
            appendRecord({
                kind: "webcontents-crashed",
                level: "critical",
                message: `WebContents ${wcId} crashed (killed=${killed})`,
                detail: {
                    ...captureMainSnapshot(),
                    wcId,
                    url: webContents.getURL(),
                    killed,
                },
            });
        });

        webContents.on("unresponsive", () => {
            appendRecord({
                kind: "webcontents-unresponsive",
                level: "warn",
                message: `WebContents ${wcId} unresponsive`,
                detail: { wcId, url: webContents.getURL() },
            });
        });

        webContents.on("responsive", () => {
            appendRecord({
                kind: "webcontents-responsive",
                level: "info",
                message: `WebContents ${wcId} responsive again`,
                detail: { wcId, url: webContents.getURL() },
            });
        });

        webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            appendRecord({
                kind: "did-fail-load",
                level: "error",
                message: `Load failed: ${errorDescription} (${errorCode})`,
                detail: { wcId, errorCode, errorDescription, validatedURL, isMainFrame },
            });
        });

        webContents.on("did-finish-load", () => {
            appendRecord({
                kind: "did-finish-load",
                level: "debug",
                message: `WebContents ${wcId} finished load`,
                detail: { wcId, url: webContents.getURL() },
            });
        });
    });

    app.on("before-quit", () => {
        appendRecord({
            kind: "before-quit",
            level: "info",
            message: "App before-quit",
            detail: captureMainSnapshot(),
        });
    });

    app.on("will-quit", (_e, exitCode) => {
        appendRecord({
            kind: "will-quit",
            level: "info",
            message: `App will-quit (code ${exitCode})`,
            detail: captureMainSnapshot({ exitCode }),
        });
    });

    process.on("uncaughtException", err => {
        appendRecord({
            kind: "uncaughtException",
            level: "critical",
            message: err.message,
            detail: {
                ...captureMainSnapshot(),
                name: err.name,
                stack: err.stack,
            },
        });
    });

    process.on("unhandledRejection", reason => {
        appendRecord({
            kind: "unhandledRejection",
            level: "error",
            message: String(reason),
            detail: {
                ...captureMainSnapshot(),
                reason: reason instanceof Error
                    ? { message: reason.message, stack: reason.stack, name: reason.name }
                    : reason,
            },
        });
    });

    process.on("warning", warning => {
        appendRecord({
            kind: "process-warning",
            level: "warn",
            message: warning.message,
            detail: {
                name: warning.name,
                stack: warning.stack,
            },
        });
    });

    setInterval(() => {
        appendRecord({
            kind: "main-heartbeat",
            level: "debug",
            message: "Main process heartbeat",
            detail: captureMainSnapshot(),
        });
    }, 60_000);

    ipcMain.handle(IpcEvents.WIMCORD_APPEND_DIAGNOSTIC, (_, line: string) => {
        try {
            writeLine(line);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle(IpcEvents.WIMCORD_READ_DIAGNOSTICS, () => {
        try {
            return readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean).slice(-MAX_READ_LINES);
        } catch {
            return [];
        }
    });

    ipcMain.handle(IpcEvents.WIMCORD_GET_LOG_PATH, () => LOG_FILE);
}

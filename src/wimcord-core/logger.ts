/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { getWimcordConfigSync } from "./config";
import { serializeForLog } from "./serializeLog";

export type WimcordLogLevel = "debug" | "info" | "warn" | "error";

export interface WimcordLogEntry {
    ts: number;
    level: WimcordLogLevel;
    scope: string;
    message: string;
    data?: unknown;
}

const MAX_BUFFER = 2500;
const buffer: WimcordLogEntry[] = [];
let hydrating = false;

let verbose = false;

export function setWimcordVerbose(enabled: boolean) {
    verbose = enabled;
}

export function isWimcordVerbose() {
    return verbose;
}

export function getWimcordLogBuffer(): readonly WimcordLogEntry[] {
    return buffer;
}

function shouldPersistLogs(): boolean {
    return IS_DISCORD_DESKTOP && getWimcordConfigSync().diagnosticsPersistToDisk;
}

function shouldPersistLevel(level: WimcordLogLevel): boolean {
    if (!shouldPersistLogs()) return false;
    if (level === "error" || level === "warn") return true;
    return getWimcordConfigSync().diagnosticsVerbose;
}

function pushEntry(entry: WimcordLogEntry, opts?: { skipPersist?: boolean; }) {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer.shift();

    if (!opts?.skipPersist && !hydrating && shouldPersistLevel(entry.level)) {
        void persistLogEntry(entry);
    }
}

async function persistLogEntry(entry: WimcordLogEntry) {
    try {
        await VencordNative.wimcord.appendDiagnostic(
            JSON.stringify({
                ts: entry.ts,
                level: entry.level,
                source: "renderer",
                kind: "log",
                scope: entry.scope,
                message: entry.message,
                detail: serializeForLog(entry.data),
            }) + "\n"
        );
    } catch {
        /* main IPC may not be ready yet */
    }
}

function parsePersistedLogLine(line: string): WimcordLogEntry | null {
    try {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (row.kind === "log" && typeof row.scope === "string" && typeof row.message === "string") {
            const level = row.level as WimcordLogLevel;
            return {
                ts: typeof row.ts === "number" ? row.ts : Date.now(),
                level: level === "debug" || level === "info" || level === "warn" || level === "error" ? level : "info",
                scope: row.scope,
                message: row.message,
                data: row.detail,
            };
        }
        // Legacy / diagnostic rows surfaced in the log view
        if (typeof row.message === "string") {
            const kind = typeof row.kind === "string" ? row.kind : "event";
            const scope = typeof row.source === "string" ? row.source : "Diagnostics";
            const level = row.level as WimcordLogLevel;
            return {
                ts: typeof row.ts === "number" ? row.ts : Date.now(),
                level: level === "debug" || level === "info" || level === "warn" || level === "error" ? level : "info",
                scope: kind === "log" ? String(row.scope ?? "Log") : kind,
                message: row.message,
                data: row.detail,
            };
        }
    } catch {
        /* ignore corrupt lines */
    }
    return null;
}

/** Restore recent log lines from disk after Discord restarts or crashes */
export async function hydrateWimcordLogsFromDisk() {
    if (!IS_DISCORD_DESKTOP || !getWimcordConfigSync().diagnosticsPersistToDisk) return;

    hydrating = true;
    try {
        const lines = await VencordNative.wimcord.readDiagnostics();
        const restored: WimcordLogEntry[] = [];
        for (const line of lines) {
            const entry = parsePersistedLogLine(line);
            if (entry) restored.push(entry);
        }
        const tail = restored.slice(-MAX_BUFFER);
        buffer.length = 0;
        for (const entry of tail) buffer.push(entry);
        if (tail.length) {
            buffer.push({
                ts: Date.now(),
                level: "info",
                scope: "Core",
                message: `Restored ${tail.length} log line(s) from previous session`,
            });
        }
    } catch {
        /* ignore */
    } finally {
        hydrating = false;
    }
}

function shouldLog(level: WimcordLogLevel): boolean {
    if (verbose) return true;
    return level !== "debug";
}

export function createWimcordLogger(scope: string) {
    const base = new Logger(scope, "#7aa2f7");

    const log = (level: WimcordLogLevel, message: string, data?: unknown) => {
        pushEntry({ ts: Date.now(), level, scope, message, data: data !== undefined ? serializeForLog(data) : undefined });
        if (!shouldLog(level)) return;

        const formatted = data !== undefined ? `${message}` : message;
        switch (level) {
            case "debug":
                base.debug(formatted, data);
                break;
            case "info":
                base.info(formatted, data);
                break;
            case "warn":
                base.warn(formatted, data);
                break;
            case "error":
                base.error(formatted, data);
                break;
        }
    };

    return {
        debug: (msg: string, data?: unknown) => log("debug", msg, data),
        info: (msg: string, data?: unknown) => log("info", msg, data),
        warn: (msg: string, data?: unknown) => log("warn", msg, data),
        error: (msg: string, data?: unknown) => log("error", msg, data),
    };
}

export const WimcordLogger = createWimcordLogger("Wimcord");

export function exportLogsAsText(): string {
    const lines = getWimcordLogBuffer().map(e => {
        const ts = new Date(e.ts).toISOString();
        const data = e.data !== undefined ? `\n  ${JSON.stringify(e.data, null, 2)}` : "";
        return `${ts} [${e.level}] ${e.scope}: ${e.message}${data}`;
    });
    return lines.join("\n\n");
}

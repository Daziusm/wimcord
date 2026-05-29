/*
 * Wimcord — crash / restart / lifecycle diagnostics
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getWimcordConfigSync, loadWimcordConfig } from "./config";
import { getDiagnosticSessionId, resetDiagnosticSessionId } from "./diagnosticsSession";
import { createWimcordLogger } from "./logger";
import { formatConsoleArgs, serializeForLog } from "./serializeLog";
import { getRuntimeState } from "./runtime";
import { captureRendererSnapshot } from "./snapshot";

const log = createWimcordLogger("Diagnostics");

export type DiagnosticLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface DiagnosticEvent {
    ts: number;
    level: DiagnosticLevel;
    source: "renderer" | "main" | "unknown";
    kind: string;
    message: string;
    sessionId?: string;
    detail?: unknown;
}

const MAX_EVENTS = 2500;
const events: DiagnosticEvent[] = [];
let rendererHooksInstalled = false;
let consoleHooksInstalled = false;

export { getDiagnosticSessionId };

export function getDiagnosticEvents(): readonly DiagnosticEvent[] {
    return events;
}

function parseDiagnosticLine(line: string): DiagnosticEvent | null {
    try {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (row.kind === "log") return null;
        if (typeof row.message !== "string") return null;
        const level = row.level as DiagnosticLevel;
        return {
            ts: typeof row.ts === "number" ? row.ts : Date.now(),
            level:
                level === "debug" || level === "info" || level === "warn" || level === "error" || level === "critical"
                    ? level
                    : "info",
            source:
                row.source === "renderer" || row.source === "main" || row.source === "unknown"
                    ? row.source
                    : "unknown",
            kind: typeof row.kind === "string" ? row.kind : "event",
            message: row.message,
            sessionId: typeof row.sessionId === "string" ? row.sessionId : undefined,
            detail: row.detail,
        };
    } catch {
        return null;
    }
}

/** Restore diagnostic history from disk (crashes, beforeunload, render-process-gone) */
export async function hydrateDiagnosticsFromDisk() {
    if (!IS_DISCORD_DESKTOP || !getWimcordConfigSync().diagnosticsPersistToDisk) return;

    hydratingDiagnostics = true;
    try {
        const lines = await VencordNative.wimcord.readDiagnostics();
        const restored: DiagnosticEvent[] = [];
        for (const line of lines) {
            const ev = parseDiagnosticLine(line);
            if (ev) restored.push(ev);
        }
        events.length = 0;
        for (const ev of restored.slice(-MAX_EVENTS)) events.push(ev);
    } catch {
        /* ignore */
    } finally {
        hydratingDiagnostics = false;
    }
}

function pushEvent(event: DiagnosticEvent, opts?: { skipConsole?: boolean; }) {
    const enriched: DiagnosticEvent = {
        sessionId: getDiagnosticSessionId(),
        ...event,
    };

    events.push(enriched);
    if (events.length > MAX_EVENTS) events.shift();

    if (!opts?.skipConsole) {
        const line = `[${enriched.kind}] ${enriched.message}`;
        switch (enriched.level) {
            case "critical":
            case "error":
                log.error(line, enriched.detail);
                break;
            case "warn":
                log.warn(line, enriched.detail);
                break;
            default:
                log.debug(line, enriched.detail);
        }
    }

    if (getWimcordConfigSync().diagnosticsPersistToDisk && IS_DISCORD_DESKTOP) {
        void persistEvent(enriched);
    }
}

let hydratingDiagnostics = false;

async function persistEvent(event: DiagnosticEvent) {
    if (hydratingDiagnostics) return;
    try {
        await VencordNative.wimcord.appendDiagnostic(JSON.stringify({
            ...event,
            detail: serializeForLog(event.detail),
        }) + "\n");
    } catch {
        /* main IPC may not be ready yet */
    }
}

export function recordDiagnostic(
    kind: string,
    message: string,
    opts?: { level?: DiagnosticLevel; detail?: unknown; source?: DiagnosticEvent["source"]; skipConsole?: boolean; }
) {
    if (!getWimcordConfigSync().diagnosticsEnabled) return;

    pushEvent({
        ts: Date.now(),
        level: opts?.level ?? "info",
        source: opts?.source ?? "renderer",
        kind,
        message,
        detail: opts?.detail,
    }, { skipConsole: opts?.skipConsole });
}

function recordSnapshot(kind: string, message: string, level: DiagnosticLevel = "debug", extra?: Record<string, unknown>) {
    recordDiagnostic(kind, message, {
        level,
        detail: captureRendererSnapshot(extra),
    });
}

function installConsoleCapture() {
    if (consoleHooksInstalled || typeof console === "undefined") return;
    consoleHooksInstalled = true;

    const cfg = getWimcordConfigSync();
    const verbose = cfg.diagnosticsVerbose;

    const wrap = (level: DiagnosticLevel, original: (...args: unknown[]) => void) => {
        return (...args: unknown[]) => {
            original.apply(console, args);
            if (!getWimcordConfigSync().diagnosticsEnabled) return;

            const isError = level === "error" || level === "critical";
            const isWarn = level === "warn";
            if (!isError && !isWarn && !verbose) return;

            recordDiagnostic(`console-${level}`, args.map(String).join(" ").slice(0, 2000), {
                level,
                detail: formatConsoleArgs(args),
                skipConsole: true,
            });
        };
    };

    console.error = wrap("error", console.error.bind(console));
    console.warn = wrap("warn", console.warn.bind(console));

    if (verbose) {
        console.log = wrap("debug", console.log.bind(console));
        console.info = wrap("info", console.info.bind(console));
        console.debug = wrap("debug", console.debug.bind(console));
    }
}

export function initWimcordDiagnosticsRenderer() {
    if (rendererHooksInstalled || typeof window === "undefined") return;
    rendererHooksInstalled = true;

    void loadWimcordConfig().then(() => {
        if (!getWimcordConfigSync().diagnosticsEnabled) return;

        installConsoleCapture();

        recordSnapshot("session", "Renderer diagnostics armed", "info", {
            restoredFromDisk: events.length > 0,
        });

        window.addEventListener("error", ev => {
            recordDiagnostic("uncaught-error", ev.message || "Unknown error", {
                level: "error",
                detail: {
                    ...captureRendererSnapshot(),
                    filename: ev.filename,
                    lineno: ev.lineno,
                    colno: ev.colno,
                    stack: ev.error?.stack,
                    error: serializeForLog(ev.error),
                },
            });
        });

        window.addEventListener("unhandledrejection", ev => {
            const reason = ev.reason;
            recordDiagnostic("unhandled-rejection", String(reason?.message ?? reason ?? "rejection"), {
                level: "error",
                detail: {
                    ...captureRendererSnapshot(),
                    reason: serializeForLog(reason),
                    stack: reason?.stack,
                },
            });
        });

        const onExit = (kind: string, message: string) => {
            recordDiagnostic(kind, message, {
                level: "warn",
                detail: captureRendererSnapshot({ exitKind: kind }),
            });
        };

        window.addEventListener("beforeunload", () => onExit("beforeunload", "Page unloading (restart, crash, or navigation)"));
        window.addEventListener("pagehide", ev => onExit("pagehide", `Page hidden (persisted=${ev.persisted})`));

        document.addEventListener("visibilitychange", () => {
            recordDiagnostic("visibility", `document.visibilityState=${document.visibilityState}`, {
                level: "debug",
                detail: { hasFocus: document.hasFocus() },
            });
        });

        window.addEventListener("online", () => recordDiagnostic("network", "Browser online", { level: "info" }));
        window.addEventListener("offline", () => recordDiagnostic("network", "Browser offline", { level: "warn" }));

        // Discord sometimes hangs before dying on older builds
        let lastBeat = Date.now();
        setInterval(() => {
            const now = Date.now();
            const delta = now - lastBeat;
            lastBeat = now;
            if (delta > 45_000) {
                recordDiagnostic("event-loop-gap", `Main thread gap ~${Math.round(delta / 1000)}s`, {
                    level: "warn",
                    detail: captureRendererSnapshot({ gapMs: delta }),
                });
            }
        }, 10_000);

        // Periodic heartbeat with full snapshot (verbose) or lite (default)
        setInterval(() => {
            const verbose = getWimcordConfigSync().diagnosticsVerbose;
            if (verbose) {
                recordSnapshot("heartbeat", "Renderer heartbeat", "debug");
            } else {
                const perf = performance as Performance & { memory?: { usedJSHeapSize: number; }; };
                recordDiagnostic("heartbeat", "Renderer alive", {
                    level: "debug",
                    detail: {
                        uptimeMs: Date.now() - getRuntimeState().startedAt,
                        memoryUsed: perf.memory?.usedJSHeapSize,
                        url: location.pathname,
                    },
                });
            }
        }, 30_000);
    });
}

export function resetDiagnosticSession(reason: string) {
    const newId = resetDiagnosticSessionId();
    recordDiagnostic("session-reset", reason, {
        level: "info",
        detail: { newSessionId: newId },
    });
}

export function recordPluginDiagnostic(pluginName: string, phase: "start" | "stop" | "error", detail?: unknown) {
    recordDiagnostic(`plugin-${phase}`, `${pluginName}: ${phase}`, {
        level: phase === "error" ? "error" : "debug",
        detail: serializeForLog(detail),
    });
}

export function exportDiagnosticsAsText(): string {
    return getDiagnosticEvents().map(e => {
        const ts = new Date(e.ts).toISOString();
        const data = e.detail !== undefined ? `\n  ${JSON.stringify(e.detail, null, 2)}` : "";
        return `${ts} [${e.level}] [${e.kind}] ${e.message}${data}`;
    }).join("\n\n");
}

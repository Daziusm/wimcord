/*
 * Wimcord — renderer environment snapshot for crash diagnostics
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getBuildNumber } from "@webpack/patcher";

import { checkCompatibility } from "./compat";
import { getPatchHealthSummaryForSnapshot } from "./patchHealth";
import { getDiagnosticSessionId } from "./diagnosticsSession";
import { getRuntimeState } from "./runtime";
import { WIMCORD_BRAND } from "./branding";

interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

export function captureRendererSnapshot(extra?: Record<string, unknown>) {
    const runtime = getRuntimeState();
    const compat = checkCompatibility();
    const perf = performance as Performance & { memory?: PerformanceMemory; };

    return {
        sessionId: getDiagnosticSessionId(),
        ts: Date.now(),
        wimcordVersion: WIMCORD_BRAND.version,
        vencordVersion: compat.vencordVersion,
        discordBuild: compat.discordBuild,
        url: typeof location !== "undefined" ? location.href : undefined,
        pathname: typeof location !== "undefined" ? location.pathname : undefined,
        hash: typeof location !== "undefined" ? location.hash : undefined,
        visibility: typeof document !== "undefined" ? document.visibilityState : undefined,
        hasFocus: typeof document !== "undefined" ? document.hasFocus() : undefined,
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        uptimeMs: Date.now() - runtime.startedAt,
        pluginsLoaded: [...runtime.pluginsLoaded],
        pluginCount: runtime.pluginsLoaded.length,
        patchCount: runtime.patchCount,
        moduleCacheHits: runtime.moduleCacheHits,
        moduleCacheMisses: runtime.moduleCacheMisses,
        memory: perf.memory
            ? {
                usedJSHeapSize: perf.memory.usedJSHeapSize,
                totalJSHeapSize: perf.memory.totalJSHeapSize,
                jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
            }
            : undefined,
        patchHealth: getPatchHealthSummaryForSnapshot(),
        ...extra,
    };
}

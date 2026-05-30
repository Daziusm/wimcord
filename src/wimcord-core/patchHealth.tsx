/*
 * Wimcord — webpack patch health & safe mode
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getBuildNumber } from "@webpack/patcher";
import { find, filters, findModuleFactory, onWebpackModuleNotFound } from "@webpack";

import { getWimcordConfigSync } from "./config";
import { recordDiagnostic } from "./diagnostics";
import { createWimcordLogger } from "./logger";
import { WIMCORD_TESTED_DISCORD_BUILD } from "./testedBuild";

const log = createWimcordLogger("PatchHealth");

export interface WebpackFailureRecord {
    ts: number;
    method: string;
    filter: unknown[];
}

export interface PatchProbeResult {
    id: string;
    label: string;
    ok: boolean;
    severity: "critical" | "warning";
}

export interface PatchHealthReport {
    ok: boolean;
    phase: string;
    discordBuild: number;
    testedDiscordBuild: number;
    buildAhead: boolean;
    criticalFailures: PatchProbeResult[];
    warnings: PatchProbeResult[];
    webpackFailureCount: number;
    recentWebpackFailures: WebpackFailureRecord[];
    probableCause: string;
    safeModeActive: boolean;
    checkedAt: number;
}

const webpackFailures: WebpackFailureRecord[] = [];
const MAX_WEBPACK_FAILURES = 60;

let latestReport: PatchHealthReport | null = null;
/** When false, HeaderBarAPI cannot inject into Discord's title bar array */
let headerBarInjectionSafe = true;
/** When false, plugins must use HeaderBarButton (Clickable) instead of Discord's HeaderBarIcon */
let headerBarNativeIconSafe = true;
let webpackHookInstalled = false;
let modalShownForBuild: number | null = null;

function serializeFilter(filter: unknown[]): unknown[] {
    return filter.map(f => {
        if (typeof f === "function") return f.toString().slice(0, 200);
        if (f instanceof RegExp) return f.toString();
        return f;
    });
}

export function getRecentWebpackFailures(): readonly WebpackFailureRecord[] {
    return webpackFailures;
}

export function getPatchHealthReport(): PatchHealthReport | null {
    return latestReport;
}

/** CustomProfile / addHeaderBarButton — only needs the title-bar patch anchor */
export function isHeaderBarInjectionSafe(): boolean {
    if (!getWimcordConfigSync().safeModeOnPatchFailure) return true;
    return headerBarInjectionSafe;
}

/** VencordToolbox / ChannelToolbarButton — needs Discord's native icon component */
export function isNativeHeaderBarIconSafe(): boolean {
    if (!getWimcordConfigSync().safeModeOnPatchFailure) return true;
    return headerBarNativeIconSafe;
}

/** @deprecated use isHeaderBarInjectionSafe or isNativeHeaderBarIconSafe */
export function isHeaderBarUiSafe(): boolean {
    return isHeaderBarInjectionSafe();
}

export function isPatchHealthDegraded(): boolean {
    return latestReport !== null && !latestReport.ok;
}

function probeCssClasses(id: string, label: string, severity: "critical" | "warning", ...names: string[]): PatchProbeResult {
    const ok = !!find(filters.byClassNames(...names), { isIndirect: true, topLevelOnly: true });
    return { id, label, ok, severity };
}

function probeCode(id: string, label: string, severity: "critical" | "warning", ...code: string[]): PatchProbeResult {
    const ok = !!find(filters.byCode(...code), { isIndirect: true });
    return { id, label, ok, severity };
}

/** Same search the webpack patcher uses (module factory source), not runtime exports */
function probeModuleFactory(id: string, label: string, severity: "critical" | "warning", ...code: string[]): PatchProbeResult {
    const ok = !!findModuleFactory(...code);
    return { id, label, ok, severity };
}

function updateHeaderBarSafety(probes: PatchProbeResult[]) {
    const iconOk = probes.find(p => p.id === "headerBar-icon")?.ok ?? true;
    const patchOk = probes.find(p => p.id === "headerBar-patch")?.ok ?? true;
    // CustomProfile uses HeaderBarButton injection — keep enabled unless native icon path is broken.
    // A failed probe often means lazy chunks; the patch may still apply when modules load.
    headerBarInjectionSafe = true;
    headerBarNativeIconSafe = iconOk;
    if (!patchOk) headerBarNativeIconSafe = false;
}

function buildProbableCause(
    discordBuild: number,
    testedBuild: number,
    buildAhead: boolean,
    critical: PatchProbeResult[],
    warnings: PatchProbeResult[],
    recentWebpack: WebpackFailureRecord[],
    safeModeActive: boolean,
): string {
    const parts: string[] = [];

    if (critical.length) {
        parts.push(`Broken patches: ${critical.map(c => c.label).join("; ")}`);
    }
    if (recentWebpack.length >= 1) {
        const last = recentWebpack.slice(-3).map(f => `${f.method}(${JSON.stringify(f.filter).slice(0, 100)})`);
        parts.push(`Runtime webpack misses: ${last.join(" → ")}`);
    }
    if (buildAhead && testedBuild > 0) {
        parts.push(`Discord build ${discordBuild} is newer than Wimcord was last validated on (${testedBuild})`);
    }
    if (warnings.length && !critical.length) {
        parts.push(`Warnings: ${warnings.map(w => w.label).join("; ")}`);
    }
    if (safeModeActive) {
        parts.push("Title-bar features limited due to repeated webpack failures");
    } else if (!headerBarNativeIconSafe) {
        parts.push("Wimcord toolbox icon hidden; CustomProfile / HeaderBarButton plugins should still work if their patch matched");
    }
    if (!parts.length) return "Patch health OK";
    return parts.join(". ") + ".";
}

export function runPatchHealthCheck(phase = "check", opts?: { applySafeMode?: boolean; }): PatchHealthReport {
    const discordBuild = getBuildNumber();
    const testedDiscordBuild = WIMCORD_TESTED_DISCORD_BUILD;
    const buildAhead = testedDiscordBuild > 0 && discordBuild > testedDiscordBuild;
    const applySafeMode = opts?.applySafeMode ?? phase !== "pre-plugins";

    const probes: PatchProbeResult[] = [
        probeModuleFactory("headerBar-patch", "Title bar patch module (BACK_FORWARD_NAVIGATION)", "warning", '?"BACK_FORWARD_NAVIGATION":'),
        probeCode("headerBar-icon", "Native title bar icon (HEADER_BAR_BADGE_BOTTOM)", "warning", ".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"'),
    ];

    const criticalFailures = probes.filter(p => !p.ok && p.severity === "critical");
    const warnings = probes.filter(p => !p.ok && p.severity === "warning");
    const recentWebpackFailures = webpackFailures.slice(-15);

    if (applySafeMode) updateHeaderBarSafety(probes);

    const runtimeWebpackBroken = recentWebpackFailures.length >= 3;
    const patchesBroken = applySafeMode && (criticalFailures.length > 0 || runtimeWebpackBroken);
    const safeModeActive = patchesBroken && getWimcordConfigSync().safeModeOnPatchFailure;

    // buildAhead alone is informational — do not mark health failed or enable safe mode for a +1 build
    const ok = !safeModeActive;

    const probableCause = buildProbableCause(
        discordBuild,
        testedDiscordBuild,
        buildAhead,
        criticalFailures,
        warnings,
        recentWebpackFailures,
        safeModeActive,
    );

    const report: PatchHealthReport = {
        ok,
        phase,
        discordBuild,
        testedDiscordBuild,
        buildAhead,
        criticalFailures,
        warnings,
        webpackFailureCount: webpackFailures.length,
        recentWebpackFailures,
        probableCause,
        safeModeActive,
        checkedAt: Date.now(),
    };

    latestReport = report;

    recordDiagnostic("patch-health", ok ? "Patch health OK" : "Patch health degraded — safe mode may be active", {
        level: ok ? "info" : "warn",
        detail: report,
    });

    if (!ok) {
        log.warn(probableCause, {
            discordBuild,
            testedDiscordBuild,
            critical: criticalFailures.map(c => c.id),
            safeModeActive,
            headerBarInjectionSafe,
            headerBarNativeIconSafe,
        });
    }

    return report;
}

function recordWebpackFailure(method: string, filter: unknown[]) {
    const rec: WebpackFailureRecord = {
        ts: Date.now(),
        method,
        filter: serializeFilter(filter),
    };
    webpackFailures.push(rec);
    if (webpackFailures.length > MAX_WEBPACK_FAILURES) webpackFailures.shift();

    if (method === "findComponentByCode") {
        headerBarNativeIconSafe = false;
    }

    recordDiagnostic("webpack-module-not-found", `webpack.${method} found no module`, {
        level: "warn",
        detail: rec,
        skipConsole: webpackFailures.length > 5,
    });
}

export function installWebpackFailureRecorder() {
    if (webpackHookInstalled) return;
    webpackHookInstalled = true;

    onWebpackModuleNotFound((method, filter) => {
        recordWebpackFailure(method, filter);
    });
}

/** Run synchronously before WebpackReady plugins so nothing touches broken header modules first */
export function gateBeforeWebpackPlugins() {
    installWebpackFailureRecorder();
    // Pre-plugin: log only — webpack cache is often incomplete at onceReady
    runPatchHealthCheck("pre-plugins", { applySafeMode: false });
}

async function maybeShowPatchHealthModal(report: PatchHealthReport) {
    if (report.ok && !report.buildAhead) return;
    if (!getWimcordConfigSync().patchHealthNotifyOnFailure) return;
    if (modalShownForBuild === report.discordBuild) return;
    modalShownForBuild = report.discordBuild;

    try {
        const { ConfirmModal, Forms, Link, Margins, openModal } = await import("@webpack/common");
        const logPath = IS_DISCORD_DESKTOP
            ? await VencordNative.wimcord.getLogPath().catch(() => null)
            : null;

        openModal(props => (
            <ConfirmModal
                {...props}
                title={report.safeModeActive ? "Wimcord — safe mode" : "Wimcord — compatibility notice"}
                confirmText="Got it"
                cancelText={IS_DISCORD_DESKTOP ? "Open logs" : undefined}
                onCancel={IS_DISCORD_DESKTOP
                    ? () => {
                        void VencordNative.wimcord.openLogFolder();
                        props.onClose();
                    }
                    : undefined}
                variant={report.safeModeActive ? "danger" : "primary"}
            >
                <Forms.FormText>{report.probableCause}</Forms.FormText>
                <Forms.FormText className={Margins.top8}>
                    Discord build <strong>{report.discordBuild}</strong>
                    {report.testedDiscordBuild > 0 && (
                        <> · Last validated <strong>{report.testedDiscordBuild}</strong></>
                    )}
                </Forms.FormText>
                {report.safeModeActive && (
                    <Forms.FormText className={Margins.top8}>
                        CustomProfile and other title-bar buttons are hidden because the injection patch did not match this Discord build.
                        Rebuild Wimcord and run Repair. You can turn off safe mode in Wimcord Settings → Diagnostics (may crash).
                    </Forms.FormText>
                )}
                {!report.safeModeActive && !headerBarNativeIconSafe && (
                    <Forms.FormText className={Margins.top8}>
                        The Wimcord toolbox icon is hidden, but CustomProfile and other HeaderBarButton plugins should still work.
                    </Forms.FormText>
                )}
                {logPath && (
                    <Forms.FormText className={Margins.top8} style={{ fontSize: 12, opacity: 0.85, wordBreak: "break-all" }}>
                        Diagnostics: {logPath}
                    </Forms.FormText>
                )}
                <Forms.FormText className={Margins.top8}>
                    <Link href="https://github.com/Daziusm/wimcord/releases">Wimcord releases</Link>
                </Forms.FormText>
            </ConfirmModal>
        ));
    } catch (e) {
        log.warn("Could not show patch health modal", e);
    }
}

export function schedulePatchHealthRechecks() {
    const run = (phase: string) => {
        const report = runPatchHealthCheck(phase);
        if (phase === "post-plugins" || phase === "delayed-5s") void maybeShowPatchHealthModal(report);
    };

    queueMicrotask(() => run("post-plugins"));
    setTimeout(() => run("delayed-5s"), 5000);
}

/** @deprecated use gateBeforeWebpackPlugins + schedulePatchHealthRechecks */
export function onWebpackPluginsStarted() {
    gateBeforeWebpackPlugins();
    schedulePatchHealthRechecks();
}

export function getPatchHealthSummaryForSnapshot() {
    const report = latestReport;
    return {
        patchHealthOk: report?.ok ?? null,
        safeModeActive: report?.safeModeActive ?? false,
        headerBarInjectionSafe,
        headerBarNativeIconSafe,
        probableCause: report?.probableCause,
        webpackFailureCount: webpackFailures.length,
        recentWebpackFailureMethods: webpackFailures.slice(-5).map(f => f.method),
    };
}

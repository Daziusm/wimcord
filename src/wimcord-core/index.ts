/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StartAt } from "@utils/types";
import { onceReady } from "@webpack";

import { WIMCORD_BRAND, displayName } from "./branding";
import { checkCompatibility } from "./compat";
import { loadWimcordConfig } from "./config";
import { applyDevModeFromConfig, installWimcordDevApi } from "./dev";
import { emitWimcordPhase } from "./lifecycle";
import { createWimcordLogger } from "./logger";
import { registerWimcordPatches } from "../wimcord-patches";
import { disableVencordBadgeSources, loadWimcordBadgesFromStore } from "./badges";
import { syncWimcordPluginEnables } from "./pluginSync";
import { hydrateDiagnosticsFromDisk, initWimcordDiagnosticsRenderer, recordDiagnostic } from "./diagnostics";
import { hydrateWimcordLogsFromDisk } from "./logger";
import { captureRendererSnapshot } from "./snapshot";

export * from "./branding";
export * from "./config";
export * from "./compat";
export * from "./dev";
export * from "./lifecycle";
export * from "./logger";
export * from "./moduleCache";
export * from "./runtime";
export * from "./types";
export * from "./pluginSync";
export * from "./badges";
export * from "./badgeRegistry";
export * from "./diagnostics";
export * from "./patchHealth";
export * from "./releaseUpdater";
export * from "./testedBuild";

const log = createWimcordLogger("Core");

let initialized = false;

/**
 * Wimcord core bootstrap — runs before plugin manager, does not touch auth.
 */
export async function initWimcordCore() {
    if (initialized) return;
    initialized = true;

    await emitWimcordPhase("pre-init");
    log.info(`${displayName()} v${WIMCORD_BRAND.version} initializing`);

    registerWimcordPatches();
    await loadWimcordConfig();
    await syncWimcordPluginEnables();
    await loadWimcordBadgesFromStore();
    await hydrateWimcordLogsFromDisk();
    await hydrateDiagnosticsFromDisk();
    await applyDevModeFromConfig();
    initWimcordDiagnosticsRenderer();
    installWimcordDevApi();

    const compat = checkCompatibility();
    if (!compat.ok) {
        log.warn("Compatibility warnings present — running in degraded mode", compat.warnings);
    }

    await emitWimcordPhase("init");
    log.info("Core ready");
    recordDiagnostic("boot", "Wimcord core initialized", {
        level: "info",
        detail: captureRendererSnapshot(),
    });

    // After plugins load, strip Vencord donor badge fetching
    queueMicrotask(() => disableVencordBadgeSources());
}

export function hookWimcordLifecycle() {
    onceReady.then(async () => {
        await emitWimcordPhase("webpack-ready");
        recordDiagnostic("webpack-ready", "Discord webpack ready", {
            level: "info",
            detail: captureRendererSnapshot(),
        });
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            void emitWimcordPhase("dom-ready");
        }, { once: true });
    } else {
        void emitWimcordPhase("dom-ready");
    }
}

export { StartAt };

/*
 * Wimcord — sync feature toggles → Vencord plugin enabled state
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";

import { loadWimcordConfig, getFeatureToggles } from "./config";
import { createWimcordLogger } from "./logger";

const log = createWimcordLogger("PluginSync");

/** Maps feature toggle id → Vencord plugin name */
export const WIMCORD_PLUGIN_BY_FEATURE: Record<string, string> = {
    performanceMonitor: "WimcordPerformanceMonitor",
    uiTweakPack: "WimcordUiTweakPack",
    networkInspector: "WimcordNetworkInspector",
};

export async function syncWimcordPluginEnables() {
    const cfg = await loadWimcordConfig();

    for (const toggle of getFeatureToggles()) {
        const pluginName = WIMCORD_PLUGIN_BY_FEATURE[toggle.id];
        if (!pluginName) continue;

        const enabled = cfg.features[toggle.id] ?? toggle.defaultEnabled;
        if (!Settings.plugins[pluginName]) {
            Settings.plugins[pluginName] = { enabled };
        } else {
            Settings.plugins[pluginName].enabled = enabled;
        }
    }

    for (const required of ["WimcordPanel", "WimcordBadges", "WimcordBadgeAdmin", "WimcordUpdater"]) {
        if (!Settings.plugins[required]) Settings.plugins[required] = { enabled: true };
        else Settings.plugins[required].enabled = true;
    }

    log.debug("Synced Wimcord plugin enables from feature toggles");
}

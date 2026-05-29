/*
 * Wimcord plugins — feature toggle helpers
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isFeatureEnabled, loadWimcordConfig } from "@wimcord-core/config";
import { recordPluginLoaded } from "@wimcord-core/runtime";

export function wimcordFeatureId(pluginFolder: string): string {
    const map: Record<string, string> = {
        performanceMonitor: "performanceMonitor",
        uiTweakPack: "uiTweakPack",
        networkInspector: "networkInspector",
        wimcordPanel: "wimcordPanel",
    };
    return map[pluginFolder] ?? pluginFolder;
}

export async function shouldStartWimcordPlugin(folderName: string): Promise<boolean> {
    await loadWimcordConfig();
    const id = wimcordFeatureId(folderName);
    if (id === "wimcordPanel") return true;
    return isFeatureEnabled(id);
}

export function markWimcordPluginStarted(name: string) {
    recordPluginLoaded(name);
}

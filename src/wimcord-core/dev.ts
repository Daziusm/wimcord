/*
 * Wimcord — maintainer-only dev API (not exposed in public builds)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { startPlugin, stopPlugin } from "@api/PluginManager";
import Plugins from "~plugins";

import { loadWimcordConfig } from "./config";
import { checkCompatibility } from "./compat";
import { clearModuleCache, getModuleCacheSize } from "./moduleCache";
import { getWimcordLogBuffer, setWimcordVerbose } from "./logger";
import { getRuntimeState, setDevMode } from "./runtime";
import { WIMCORD_BRAND } from "./branding";
import { WIMCORD_PUBLIC_RELEASE } from "./publicRelease";

export interface WimcordDevApi {
    version: string;
    getState: typeof getRuntimeState;
    getLogs: typeof getWimcordLogBuffer;
    getCompat: typeof checkCompatibility;
    setVerbose: (on: boolean) => void;
    reloadPlugin: (name: string) => Promise<boolean>;
    clearModuleCache: typeof clearModuleCache;
    moduleCacheSize: typeof getModuleCacheSize;
}

async function reloadPlugin(name: string): Promise<boolean> {
    const plugin = Plugins[name];
    if (!plugin) return false;

    try {
        stopPlugin(plugin);
        startPlugin(plugin);
        return true;
    } catch {
        return false;
    }
}

export function installWimcordDevApi() {
    if (WIMCORD_PUBLIC_RELEASE) return;

    const api: WimcordDevApi = {
        version: WIMCORD_BRAND.version,
        getState: getRuntimeState,
        getLogs: getWimcordLogBuffer,
        getCompat: checkCompatibility,
        setVerbose: setWimcordVerbose,
        reloadPlugin,
        clearModuleCache,
        moduleCacheSize: getModuleCacheSize,
    };

    (globalThis as typeof globalThis & { Wimcord?: WimcordDevApi }).Wimcord = api;

    if (IS_DEV) {
        console.info(
            `%c[Wimcord Dev]%c window.Wimcord — reloadPlugin(), getLogs(), getState()`,
            "color:#7aa2f7;font-weight:bold",
            "color:inherit"
        );
    }
}

export async function applyDevModeFromConfig() {
    const cfg = await loadWimcordConfig();
    setDevMode(IS_DEV && !WIMCORD_PUBLIC_RELEASE);
    setWimcordVerbose(
        (IS_DEV && !WIMCORD_PUBLIC_RELEASE) ||
        (cfg.diagnosticsEnabled && cfg.diagnosticsVerbose)
    );
}

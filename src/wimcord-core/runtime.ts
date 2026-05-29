/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { patches } from "@webpack/patcher";

import type { WimcordRuntimeState } from "./types";

const state: WimcordRuntimeState = {
    startedAt: Date.now(),
    devMode: IS_DEV,
    pluginsLoaded: [],
    patchCount: 0,
    moduleCacheHits: 0,
    moduleCacheMisses: 0,
};

export function getRuntimeState(): WimcordRuntimeState {
    state.patchCount = patches.length;
    return state;
}

export function setDevMode(enabled: boolean) {
    state.devMode = enabled;
}

export function recordPluginLoaded(name: string) {
    if (!state.pluginsLoaded.includes(name)) state.pluginsLoaded.push(name);
}

export function recordModuleCacheHit() {
    state.moduleCacheHits++;
}

export function recordModuleCacheMiss() {
    state.moduleCacheMisses++;
}

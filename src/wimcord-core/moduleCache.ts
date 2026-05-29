/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getWimcordConfigSync } from "./config";
import { getRuntimeState, recordModuleCacheHit, recordModuleCacheMiss } from "./runtime";

const cache = new Map<string, unknown>();

export function getCachedModule<T>(key: string, resolver: () => T): T {
    if (!getWimcordConfigSync().moduleCacheEnabled) {
        return resolver();
    }

    if (cache.has(key)) {
        recordModuleCacheHit();
        return cache.get(key) as T;
    }

    recordModuleCacheMiss();
    const value = resolver();
    cache.set(key, value);
    return value;
}

export function clearModuleCache() {
    cache.clear();
    getRuntimeState().moduleCacheHits = 0;
    getRuntimeState().moduleCacheMisses = 0;
}

export function getModuleCacheSize() {
    return cache.size;
}

/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

import type { WimcordFeatureToggle } from "./types";

const STORE_KEY = "Wimcord_config_v1";

export interface WimcordConfig {
    devMode: boolean;
    showWimcordPanel: boolean;
    lazyLoadPlugins: boolean;
    moduleCacheEnabled: boolean;
    /** When false, Vencord donor/contributor badges are not shown */
    useVencordBadges: boolean;
    diagnosticsEnabled: boolean;
    diagnosticsPersistToDisk: boolean;
    /** When true, persist debug logs, console capture, and full heartbeat snapshots */
    diagnosticsVerbose: boolean;
    /** JSON manifest URL: { "version": "0.1.1", "notes": "...", "installerUrl": "..." } */
    updateManifestUrl: string;
    /** Who has Wimcord badges — fetched periodically (see wimcord-badges.example.json) */
    badgeRegistryUrl: string;
    /** POST endpoint — enrolls the signed-in Discord user as a Wimcord user */
    badgeRegisterUrl: string;
    /** On startup, register this client with badgeRegisterUrl */
    badgeAutoRegister: boolean;
    features: Record<string, boolean>;
}

const FEATURE_TOGGLES: WimcordFeatureToggle[] = [
    {
        id: "performanceMonitor",
        label: "Performance monitor",
        description: "Lightweight FPS and memory overlay",
        defaultEnabled: true,
    },
    {
        id: "uiTweakPack",
        label: "UI tweak pack",
        description: "Optional minimal UI polish (plugin-gated)",
        defaultEnabled: false,
    },
    {
        id: "networkInspector",
        label: "Network inspector",
        description: "Optional fetch/XHR logging — off by default",
        defaultEnabled: false,
    },
];

function defaultFeatures(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const f of FEATURE_TOGGLES) out[f.id] = f.defaultEnabled;
    return out;
}

const DEFAULT_CONFIG: WimcordConfig = {
    devMode: IS_DEV,
    showWimcordPanel: true,
    lazyLoadPlugins: true,
    moduleCacheEnabled: true,
    useVencordBadges: false,
    diagnosticsEnabled: true,
    diagnosticsPersistToDisk: true,
    diagnosticsVerbose: true,
    updateManifestUrl: "",
    badgeRegistryUrl: "https://wim.wimdium.com/wimcord/badges.json",
    badgeRegisterUrl: "https://wim.wimdium.com/api/wimcord/register",
    badgeAutoRegister: true,
    features: defaultFeatures(),
};

let cached: WimcordConfig | null = null;

export function getFeatureToggles(): readonly WimcordFeatureToggle[] {
    return FEATURE_TOGGLES;
}

export async function loadWimcordConfig(): Promise<WimcordConfig> {
    if (cached) return cached;

    const stored = await get<WimcordConfig>(STORE_KEY);
    cached = {
        ...DEFAULT_CONFIG,
        ...stored,
        features: {
            ...defaultFeatures(),
            ...stored?.features,
        },
    };
    if (!cached.badgeRegistryUrl?.trim()) cached.badgeRegistryUrl = DEFAULT_CONFIG.badgeRegistryUrl;
    if (!cached.badgeRegisterUrl?.trim()) cached.badgeRegisterUrl = DEFAULT_CONFIG.badgeRegisterUrl;
    if (cached.badgeAutoRegister == null) cached.badgeAutoRegister = DEFAULT_CONFIG.badgeAutoRegister;
    return cached;
}

export function getWimcordConfigSync(): WimcordConfig {
    if (!cached) {
        cached = { ...DEFAULT_CONFIG, features: defaultFeatures() };
    }
    if (!cached.badgeRegistryUrl?.trim()) cached.badgeRegistryUrl = DEFAULT_CONFIG.badgeRegistryUrl;
    if (!cached.badgeRegisterUrl?.trim()) cached.badgeRegisterUrl = DEFAULT_CONFIG.badgeRegisterUrl;
    if (cached.badgeAutoRegister == null) cached.badgeAutoRegister = DEFAULT_CONFIG.badgeAutoRegister;
    return cached;
}

export async function saveWimcordConfig(patch: Partial<WimcordConfig>): Promise<WimcordConfig> {
    const current = await loadWimcordConfig();
    cached = {
        ...current,
        ...patch,
        features: {
            ...current.features,
            ...patch.features,
        },
    };
    await set(STORE_KEY, cached);
    return cached;
}

export function isFeatureEnabled(featureId: string): boolean {
    return getWimcordConfigSync().features[featureId] ?? false;
}

export async function setFeatureEnabled(featureId: string, enabled: boolean) {
    const cfg = await loadWimcordConfig();
    await saveWimcordConfig({
        features: { ...cfg.features, [featureId]: enabled },
    });
}

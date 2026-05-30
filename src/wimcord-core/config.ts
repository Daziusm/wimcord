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
    /** Disable risky UI hooks when webpack probes fail (reduces crash loops) */
    safeModeOnPatchFailure: boolean;
    /** Show a modal when patch health fails after Discord updates */
    patchHealthNotifyOnFailure: boolean;
    /** Optional override URL for update JSON. Empty = check GitHub Releases API. */
    updateManifestUrl: string;
    /** Desktop notification when a newer GitHub release exists */
    updateNotificationsEnabled: boolean;
    /** How often to re-check (hours). 0 = only on Discord startup. */
    updateCheckIntervalHours: number;
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
    safeModeOnPatchFailure: true,
    patchHealthNotifyOnFailure: true,
    updateManifestUrl: "",
    updateNotificationsEnabled: true,
    updateCheckIntervalHours: 6,
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
    if (cached.safeModeOnPatchFailure == null) cached.safeModeOnPatchFailure = DEFAULT_CONFIG.safeModeOnPatchFailure;
    if (cached.patchHealthNotifyOnFailure == null) cached.patchHealthNotifyOnFailure = DEFAULT_CONFIG.patchHealthNotifyOnFailure;
    if (cached.updateNotificationsEnabled == null) cached.updateNotificationsEnabled = DEFAULT_CONFIG.updateNotificationsEnabled;
    if (cached.updateCheckIntervalHours == null) cached.updateCheckIntervalHours = DEFAULT_CONFIG.updateCheckIntervalHours;
    return cached;
}

export function getWimcordConfigSync(): WimcordConfig {
    if (!cached) {
        cached = { ...DEFAULT_CONFIG, features: defaultFeatures() };
    }
    if (!cached.badgeRegistryUrl?.trim()) cached.badgeRegistryUrl = DEFAULT_CONFIG.badgeRegistryUrl;
    if (!cached.badgeRegisterUrl?.trim()) cached.badgeRegisterUrl = DEFAULT_CONFIG.badgeRegisterUrl;
    if (cached.badgeAutoRegister == null) cached.badgeAutoRegister = DEFAULT_CONFIG.badgeAutoRegister;
    if (cached.safeModeOnPatchFailure == null) cached.safeModeOnPatchFailure = DEFAULT_CONFIG.safeModeOnPatchFailure;
    if (cached.patchHealthNotifyOnFailure == null) cached.patchHealthNotifyOnFailure = DEFAULT_CONFIG.patchHealthNotifyOnFailure;
    if (cached.updateNotificationsEnabled == null) cached.updateNotificationsEnabled = DEFAULT_CONFIG.updateNotificationsEnabled;
    if (cached.updateCheckIntervalHours == null) cached.updateCheckIntervalHours = DEFAULT_CONFIG.updateCheckIntervalHours;
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

/*
 * Wimcord — remote badge registry (fetch + auto-register on wim.wimdium.com or self-host)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { BadgePosition } from "@api/Badges";
import { onceReady } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";

import { WIMCORD_BRAND } from "./branding";
import { resolveBadgeIconUrl } from "./badgeIconUrl";
import type { WimcordBadgeDefinition } from "./types";
import { getWimcordConfigSync, loadWimcordConfig } from "./config";
import { createWimcordLogger } from "./logger";

const log = createWimcordLogger("BadgeRegistry");

const REGISTER_STATE_KEY = "Wimcord_badgeRegisterState_v1";
const REFETCH_MS = 30 * 60 * 1000;
const REGISTER_RETRY_MS = 5000;
const REGISTER_MAX_ATTEMPTS = 36;

/** Shown for enrolled Wimcord users when the registry does not override metadata */
export const WIMCORD_USER_BADGE: WimcordBadgeDefinition = {
    id: "user",
    description: "Wimcord User",
    iconSrc: "https://cdn.discordapp.com/emojis/1238120638020063377.png",
    position: BadgePosition.END,
};

interface BadgeRegistryManifest {
    version?: number;
    badges?: WimcordBadgeDefinition[];
}

type VencordStyleRegistry = Record<string, Array<{ tooltip?: string; badge?: string; link?: string }>>;

const remoteGrants = new Map<string, Set<string>>();
const remoteMeta = new Map<string, WimcordBadgeDefinition>();
let lastFetchedAt = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let registrationScheduled = false;
let onConnectionOpen: (() => void) | null = null;

function isVencordStyleRegistry(data: unknown): data is VencordStyleRegistry {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    if ("badges" in data) return false;
    return Object.keys(data).some(k => /^\d{17,20}$/.test(k));
}

function applyManifest(manifest: BadgeRegistryManifest) {
    if (!manifest.badges?.length) return;

    for (const def of manifest.badges) {
        if (!def.id) continue;
        remoteMeta.set(def.id, {
            ...WIMCORD_USER_BADGE,
            ...def,
            iconSrc: resolveBadgeIconUrl(def.iconSrc ?? WIMCORD_USER_BADGE.iconSrc),
            userIds: undefined,
        });
        const set = remoteGrants.get(def.id) ?? new Set<string>();
        for (const id of def.userIds ?? []) set.add(id);
        remoteGrants.set(def.id, set);
    }
}

function applyVencordStyle(data: VencordStyleRegistry) {
    const set = remoteGrants.get("user") ?? new Set<string>();
    if (!remoteMeta.has("user")) remoteMeta.set("user", { ...WIMCORD_USER_BADGE });

    for (const [userId, entries] of Object.entries(data)) {
        if (!/^\d{17,20}$/.test(userId) || !entries?.length) continue;
        set.add(userId);
        const first = entries[0];
        if (first?.tooltip || first?.badge) {
            remoteMeta.set("user", {
                ...WIMCORD_USER_BADGE,
                description: first.tooltip ?? WIMCORD_USER_BADGE.description,
                iconSrc: resolveBadgeIconUrl(first.badge ?? WIMCORD_USER_BADGE.iconSrc),
                link: first.link,
            });
        }
    }
    remoteGrants.set("user", set);
}

export async function fetchBadgeRegistry(force = false): Promise<boolean> {
    await loadWimcordConfig();
    const url = getWimcordConfigSync().badgeRegistryUrl?.trim();
    if (!url) return false;

    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < 15_000) return true;

    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();

        remoteGrants.clear();
        remoteMeta.clear();

        if (isVencordStyleRegistry(data)) {
            applyVencordStyle(data);
        } else {
            applyManifest(data as BadgeRegistryManifest);
        }

        lastFetchedAt = Date.now();
        const total = [...remoteGrants.values()].reduce((n, s) => n + s.size, 0);
        log.info(`Badge registry loaded (${total} grant(s) across ${remoteGrants.size} badge(s))`);
        return true;
    } catch (e) {
        log.warn("Failed to fetch badge registry", e);
        return false;
    }
}

export function getCurrentDiscordUserId(): string | null {
    try {
        return UserStore.getCurrentUser()?.id ?? null;
    } catch {
        return null;
    }
}

/** True when this Discord account is running Wimcord (shows badge on your own profile immediately). */
export function isSelfWimcordUser(userId: string): boolean {
    if (!getWimcordConfigSync().badgeAutoRegister) return false;
    const self = getCurrentDiscordUserId();
    return self != null && self === userId;
}

async function shouldRegisterAgain(userId: string): Promise<boolean> {
    const state = await get<{ userId: string; version: string; at: number }>(REGISTER_STATE_KEY);
    if (!state || state.userId !== userId) return true;
    if (state.version !== WIMCORD_BRAND.version) return true;
    return Date.now() - state.at > 7 * 24 * 60 * 60 * 1000;
}

export async function registerCurrentWimcordUser(): Promise<boolean> {
    await loadWimcordConfig();
    if (!getWimcordConfigSync().badgeAutoRegister) return false;

    const url = getWimcordConfigSync().badgeRegisterUrl?.trim();
    if (!url) return false;

    await onceReady;
    const user = UserStore.getCurrentUser();
    if (!user?.id) {
        log.debug("UserStore not ready — will retry badge registration");
        return false;
    }

    if (!(await shouldRegisterAgain(user.id))) {
        log.debug("Badge registration skipped (already registered recently)");
        return true;
    }

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user.id,
                username: user.username,
                globalName: (user as { globalName?: string }).globalName ?? null,
                wimcordVersion: WIMCORD_BRAND.version,
                platform: IS_DISCORD_DESKTOP ? "desktop" : "web",
            }),
        });

        if (!res.ok) {
            if (res.status === 400) {
                log.debug(`Badge registration rejected (${res.status}) — registry may not accept this account yet`);
                return false;
            }
            throw new Error(`${res.status} ${res.statusText}`);
        }

        await set(REGISTER_STATE_KEY, {
            userId: user.id,
            version: WIMCORD_BRAND.version,
            at: Date.now(),
        });

        log.info(`Registered Discord user ${user.id} for Wimcord badge`);
        await fetchBadgeRegistry(true);
        return true;
    } catch (e) {
        log.warn("Badge registration failed", e);
        return false;
    }
}

async function runRegistrationWithRetries() {
    for (let attempt = 1; attempt <= REGISTER_MAX_ATTEMPTS; attempt++) {
        const ok = await registerCurrentWimcordUser();
        if (ok) return;
        await new Promise(r => setTimeout(r, REGISTER_RETRY_MS));
    }
    log.warn("Badge registration gave up after retries — use Wimcord Panel → Register & refresh badges now");
}

function scheduleBadgeRegistration() {
    if (registrationScheduled) return;
    registrationScheduled = true;

    void onceReady.then(() => {
        void runRegistrationWithRetries();

        onConnectionOpen = () => {
            void registerCurrentWimcordUser();
        };
        FluxDispatcher.subscribe("CONNECTION_OPEN", onConnectionOpen);
    });
}

export function userHasRemoteBadge(badgeId: string, userId: string): boolean {
    return remoteGrants.get(badgeId)?.has(userId) ?? false;
}

export function getRemoteBadgeDefinition(badgeId: string): WimcordBadgeDefinition | undefined {
    return remoteMeta.get(badgeId);
}

export function getRemoteBadgeIds(): string[] {
    return [...remoteGrants.keys()];
}

export function getRemoteGrantCount(): number {
    return [...remoteGrants.values()].reduce((n, s) => n + s.size, 0);
}

export function isRemoteRegistryActive(): boolean {
    return Boolean(getWimcordConfigSync().badgeRegistryUrl?.trim()) && remoteGrants.size > 0;
}

export async function startBadgeRegistrySync() {
    await loadWimcordConfig();

    if (!getWimcordConfigSync().badgeRegistryUrl?.trim()) {
        log.debug("No badgeRegistryUrl — remote badges disabled");
        return;
    }

    await fetchBadgeRegistry(true);
    scheduleBadgeRegistration();

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        void fetchBadgeRegistry();
    }, REFETCH_MS);
}

export function stopBadgeRegistrySync() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    if (onConnectionOpen) {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", onConnectionOpen);
        onConnectionOpen = null;
    }
    registrationScheduled = false;
}

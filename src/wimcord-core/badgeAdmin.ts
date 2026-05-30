/*
 * Wimcord — in-client badge registry admin (allowlisted Discord user only)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

import { fetchBadgeRegistry, getCurrentDiscordUserId } from "./badgeRegistry";
import { resolveBadgeIconUrl } from "./badgeIconUrl";
import { getWimcordConfigSync } from "./config";
import type { WimcordBadgeDefinition } from "./types";
import { createWimcordLogger } from "./logger";

const log = createWimcordLogger("BadgeAdmin");

const ADMIN_KEY_STORE = "Wimcord_badgeAdminKey_v1";

/** Only these Discord accounts see the badge admin panel in settings */
export const WIMCORD_BADGE_ADMIN_USER_IDS = ["1365507060535529694"] as const;

export const BADGE_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export interface WimcordAdminRegistry {
    version?: number;
    badges: WimcordBadgeDefinition[];
    grants: Record<string, string[]>;
}

export function isWimcordBadgeAdmin(): boolean {
    const id = getCurrentDiscordUserId();
    return Boolean(id && (WIMCORD_BADGE_ADMIN_USER_IDS as readonly string[]).includes(id));
}

export function validateBadgeId(id: string): string | null {
    const trimmed = id.trim();
    if (!trimmed) return "Badge id is required";
    if (/^\d{17,20}$/.test(trimmed)) {
        return "That looks like a Discord user id. Use a slug (e.g. early-user) and grant under Grant badge.";
    }
    if (!BADGE_ID_PATTERN.test(trimmed)) {
        return "Badge id must be lowercase letters, numbers, _ or - (e.g. early-user)";
    }
    return null;
}

export function validateDiscordUserId(id: string): string | null {
    const trimmed = id.trim();
    if (!/^\d{17,20}$/.test(trimmed)) return "Enter a valid Discord user id (17–20 digits)";
    return null;
}

function adminApiBase(): string {
    const register = getWimcordConfigSync().badgeRegisterUrl?.trim();
    if (!register) return "";
    try {
        const u = new URL(register);
        return `${u.origin}/api/wimcord/admin`;
    } catch {
        return "";
    }
}

export async function getBadgeAdminKey(): Promise<string | null> {
    return (await get<string>(ADMIN_KEY_STORE)) ?? null;
}

export async function setBadgeAdminKey(key: string): Promise<void> {
    await set(ADMIN_KEY_STORE, key.trim());
}

async function adminFetch(path: string, init?: RequestInit) {
    const key = await getBadgeAdminKey();
    if (!key?.trim()) throw new Error("Save your admin secret key first (from the badge server).");

    const base = adminApiBase();
    if (!base) throw new Error("badgeRegisterUrl is not configured.");

    const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key.trim()}`,
            ...init?.headers,
        },
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }

    if (!res.ok) {
        const msg = typeof body === "object" && body && "message" in body
            ? String((body as { message: unknown }).message)
            : text || res.statusText;
        throw new Error(msg || `${res.status} ${res.statusText}`);
    }

    return body;
}

export async function testBadgeAdminKey(): Promise<boolean> {
    await adminFetch("/registry");
    return true;
}

function normalizeGrants(raw: unknown): Record<string, string[]> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

    const out: Record<string, string[]> = {};
    for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!/^\d{17,20}$/.test(userId)) continue;
        if (Array.isArray(value)) {
            out[userId] = value.filter((x): x is string => typeof x === "string");
        } else if (typeof value === "string") {
            out[userId] = [value];
        }
    }
    return out;
}

function mergeGrants(
    base: Record<string, string[]>,
    extra: Record<string, string[]>
): Record<string, string[]> {
    const out = { ...base };
    for (const [userId, badgeIds] of Object.entries(extra)) {
        out[userId] = [...new Set([...(out[userId] ?? []), ...badgeIds])];
    }
    return out;
}

function parseBadgesFromRegistry(raw: unknown): {
    badges: WimcordBadgeDefinition[];
    grantsFromBadges: Record<string, string[]>;
} {
    const badges: WimcordBadgeDefinition[] = [];
    const grantsFromBadges: Record<string, string[]> = {};

    if (!Array.isArray(raw)) return { badges, grantsFromBadges };

    for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id.trim() : "";
        if (!id) continue;

        const description = typeof row.description === "string" && row.description.trim()
            ? row.description.trim()
            : id;
        const iconRaw = typeof row.iconSrc === "string"
            ? row.iconSrc
            : typeof row.badge === "string"
                ? row.badge
                : "";
        if (!iconRaw.trim()) continue;

        badges.push({
            id,
            description,
            iconSrc: resolveBadgeIconUrl(iconRaw.trim()),
            link: typeof row.link === "string" && row.link.trim() ? row.link.trim() : undefined,
        });

        const userIds = row.userIds;
        if (Array.isArray(userIds)) {
            for (const uid of userIds) {
                if (typeof uid !== "string" || !/^\d{17,20}$/.test(uid)) continue;
                const list = grantsFromBadges[uid] ?? [];
                if (!list.includes(id)) list.push(id);
                grantsFromBadges[uid] = list;
            }
        }
    }

    return { badges, grantsFromBadges };
}

export async function fetchAdminRegistry(): Promise<WimcordAdminRegistry> {
    const data = await adminFetch("/registry") as Record<string, unknown>;
    const { badges, grantsFromBadges } = parseBadgesFromRegistry(data?.badges);
    const grants = mergeGrants(normalizeGrants(data?.grants), grantsFromBadges);

    return {
        version: typeof data?.version === "number" ? data.version : undefined,
        badges,
        grants,
    };
}

async function refreshPublicRegistryAfterAdminChange() {
    try {
        await fetchBadgeRegistry(true);
    } catch (e) {
        log.warn("Could not refresh public badge registry after admin change", e);
    }
}

export async function upsertAdminBadge(def: Pick<WimcordBadgeDefinition, "id" | "description" | "iconSrc" | "link">) {
    const idErr = validateBadgeId(def.id);
    if (idErr) throw new Error(idErr);

    await adminFetch(`/badges/${encodeURIComponent(def.id.trim())}`, {
        method: "PUT",
        body: JSON.stringify({
            description: def.description.trim(),
            iconSrc: resolveBadgeIconUrl(def.iconSrc.trim()),
            link: def.link?.trim() || undefined,
        }),
    });

    void refreshPublicRegistryAfterAdminChange();
}

export async function deleteAdminBadge(badgeId: string) {
    const idErr = validateBadgeId(badgeId);
    if (idErr) throw new Error(idErr);
    if (badgeId === "user") throw new Error("Cannot delete the default user badge");

    await adminFetch(`/badges/${encodeURIComponent(badgeId.trim())}`, { method: "DELETE" });
    void refreshPublicRegistryAfterAdminChange();
}

export async function grantAdminBadge(badgeId: string, userId: string, grant: boolean) {
    const idErr = validateBadgeId(badgeId);
    if (idErr) throw new Error(idErr);
    const userErr = validateDiscordUserId(userId);
    if (userErr) throw new Error(userErr);

    await adminFetch("/grant", {
        method: "POST",
        body: JSON.stringify({
            badgeId: badgeId.trim(),
            userId: userId.trim(),
            grant,
        }),
    });

    void refreshPublicRegistryAfterAdminChange();
}

export async function saveBadgeAdminKeyAndTest(key: string): Promise<void> {
    await setBadgeAdminKey(key);
    await testBadgeAdminKey();
    log.info("Badge admin key verified");
}

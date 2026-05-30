/*
 * Wimcord — custom profile badge registry (separate from Vencord donor badges)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import type { ProfileBadge, BadgeUserArgs } from "@api/Badges";
import { BadgePosition } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";

import {
    getRemoteBadgeDefinition,
    getRemoteBadgeIds,
    isSelfWimcordUser,
    userHasRemoteBadge,
    WIMCORD_USER_BADGE,
} from "./badgeRegistry";
import { WimcordBadgeImage } from "./badgeImage";
import { resolveBadgeIconUrl } from "./badgeIconUrl";
import { createWimcordLogger } from "./logger";
import type { WimcordBadgeDefinition } from "./types";

export type { WimcordBadgeDefinition } from "./types";

const log = createWimcordLogger("Badges");

const registry = new Map<string, WimcordBadgeDefinition>();
const STORE_KEY = "Wimcord_badges_v1";

export function registerWimcordBadge(def: WimcordBadgeDefinition) {
    registry.set(def.id, def);
}

export function unregisterWimcordBadge(id: string) {
    registry.delete(id);
}

export function getWimcordBadgeDefinitions(): WimcordBadgeDefinition[] {
    return [...registry.values()];
}

export async function loadWimcordBadgesFromStore(): Promise<WimcordBadgeDefinition[]> {
    const stored = await get<WimcordBadgeDefinition[]>(STORE_KEY);
    if (!stored?.length) return [];

    registry.clear();
    for (const b of stored) registerWimcordBadge(b);
    log.info(`Loaded ${stored.length} custom badge(s) from store`);
    return stored;
}

export async function saveWimcordBadgesToStore(badges: WimcordBadgeDefinition[]) {
    registry.clear();
    for (const b of badges) registerWimcordBadge(b);
    await set(STORE_KEY, badges);
}

function userReceivesBadge(def: WimcordBadgeDefinition, userId: string): boolean {
    if (def.userIds?.includes(userId)) return true;
    if (userHasRemoteBadge(def.id, userId)) return true;
    if (def.id === "user" && isSelfWimcordUser(userId)) return true;
    return false;
}

function toProfileBadge(def: WimcordBadgeDefinition): ProfileBadge {
    const remote = getRemoteBadgeDefinition(def.id);
    const merged = remote ? { ...def, ...remote, userIds: def.userIds } : def;

    const iconSrc = resolveBadgeIconUrl(merged.iconSrc);

    return {
        id: `wimcord_${merged.id}`,
        description: merged.description,
        iconSrc,
        component: ErrorBoundary.wrap(WimcordBadgeImage, { noop: true }),
        link: merged.link,
        position: merged.position ?? BadgePosition.END,
        props: {
            style: { borderRadius: "50%" },
        },
    };
}

export function getWimcordProfileBadges(args: BadgeUserArgs): ProfileBadge[] {
    const out: ProfileBadge[] = [];
    const seen = new Set<string>();

    const candidates = new Map<string, WimcordBadgeDefinition>();
    for (const def of registry.values()) candidates.set(def.id, def);
    if (!candidates.has("user")) candidates.set("user", WIMCORD_USER_BADGE);
    for (const id of getRemoteBadgeIds()) {
        if (!candidates.has(id)) {
            const meta = getRemoteBadgeDefinition(id) ?? (id === "user" ? WIMCORD_USER_BADGE : undefined);
            if (meta) candidates.set(id, meta);
        }
    }

    for (const def of candidates.values()) {
        if (!def || seen.has(def.id)) continue;
        if (!userReceivesBadge(def, args.userId)) continue;
        seen.add(def.id);
        out.push(toProfileBadge(def));
    }

    return out;
}

export function wrapWimcordBadgeComponent(badge: ProfileBadge) {
    if (badge.component) {
        badge.component = ErrorBoundary.wrap(badge.component, { noop: true });
    }
    return badge;
}

export function disableVencordBadgeSources() {
    try {
        const BadgeAPI = Vencord.Plugins.plugins.BadgeAPI as {
            getDonorBadges?: (id: string) => unknown;
            stop?: () => void;
            start?: () => Promise<void>;
        } | undefined;

        if (BadgeAPI) {
            BadgeAPI.getDonorBadges = () => null;
            log.info("Disabled Vencord donor badge fetch");
        }
    } catch (e) {
        log.warn("Could not disable Vencord badge sources", e);
    }
}

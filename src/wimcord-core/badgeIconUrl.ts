/*
 * Wimcord — Discord CDN badge icon URLs (signed attachment links expire)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const DISCORD_CDN_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);

/**
 * Normalize a badge icon URL for display. Discord attachment links with `ex`/`hm`
 * query params expire and render as blank badges; we prefer stable media-proxy paths.
 */
export function resolveBadgeIconUrl(url: string): string {
    const trimmed = url?.trim();
    if (!trimmed) return trimmed;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (!DISCORD_CDN_HOSTS.has(host)) return trimmed;

        if (parsed.pathname.includes("/attachments/")) {
            parsed.hostname = "media.discordapp.net";
            parsed.search = "";
            return parsed.href;
        }

        if (parsed.pathname.includes("/emojis/")) {
            parsed.hostname = "cdn.discordapp.com";
            if (!parsed.searchParams.has("size")) parsed.searchParams.set("size", "96");
            parsed.searchParams.delete("ex");
            parsed.searchParams.delete("is");
            parsed.searchParams.delete("hm");
            return parsed.href;
        }

        if (parsed.pathname.includes("/avatars/") || parsed.pathname.includes("/icons/")) {
            if (!parsed.searchParams.has("size")) parsed.searchParams.set("size", "128");
            parsed.searchParams.delete("ex");
            parsed.searchParams.delete("is");
            parsed.searchParams.delete("hm");
            return parsed.href;
        }

        parsed.searchParams.delete("ex");
        parsed.searchParams.delete("is");
        parsed.searchParams.delete("hm");
        return parsed.href;
    } catch {
        return trimmed;
    }
}

/** Alternate URLs to try when the primary src fails to load */
export function getBadgeIconFallbacks(url: string): string[] {
    const trimmed = url?.trim();
    if (!trimmed) return [];

    const out: string[] = [];
    const add = (candidate: string) => {
        if (candidate && candidate !== trimmed && !out.includes(candidate)) out.push(candidate);
    };

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (!DISCORD_CDN_HOSTS.has(host)) return out;

        if (parsed.pathname.includes("/attachments/")) {
            const basePath = parsed.pathname;
            add(`https://media.discordapp.net${basePath}`);
            add(`https://cdn.discordapp.com${basePath}`);
            const noQuery = new URL(trimmed);
            noQuery.search = "";
            add(noQuery.href);
        }
    } catch {
        /* ignore */
    }

    return out;
}

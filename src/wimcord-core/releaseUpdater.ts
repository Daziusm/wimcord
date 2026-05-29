/*
 * Wimcord — release manifest checker (separate from Vencord git updater)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

import { WIMCORD_BRAND } from "./branding";
import { getWimcordConfigSync, loadWimcordConfig } from "./config";
import { createWimcordLogger } from "./logger";

const log = createWimcordLogger("ReleaseUpdater");

export interface WimcordReleaseManifest {
    version: string;
    notes?: string;
    publishedAt?: string;
    /** URL to installer or release page */
    installerUrl?: string;
    /** Optional direct download for portable build */
    downloadUrl?: string;
}

const DISMISSED_KEY = "Wimcord_dismissedRelease";

function parseVersion(v: string): number[] {
    return v.replace(/^v/i, "").split(".").map(n => parseInt(n, 10) || 0);
}

export function isNewerVersion(current: string, remote: string): boolean {
    const a = parseVersion(current);
    const b = parseVersion(remote);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (y > x) return true;
        if (y < x) return false;
    }
    return false;
}

export async function fetchWimcordRelease(): Promise<WimcordReleaseManifest | null> {
    await loadWimcordConfig();
    const url = getWimcordConfigSync().updateManifestUrl?.trim();
    if (!url) return null;

    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json() as WimcordReleaseManifest;
    } catch (e) {
        log.warn("Failed to fetch release manifest", e);
        return null;
    }
}

export async function checkWimcordRelease() {
    const manifest = await fetchWimcordRelease();
    if (!manifest?.version) return null;

    if (!isNewerVersion(WIMCORD_BRAND.version, manifest.version)) return null;

    const dismissed = await get<string>(DISMISSED_KEY);
    if (dismissed === manifest.version) return null;

    return manifest;
}

export async function dismissWimcordRelease(version: string) {
    await set(DISMISSED_KEY, version);
}

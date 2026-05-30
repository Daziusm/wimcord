/*
 * Wimcord — release checker (GitHub Releases + optional custom manifest URL)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

import { WIMCORD_BRAND, WIMCORD_GITHUB } from "./branding";
import { getWimcordConfigSync, loadWimcordConfig } from "./config";
import { createWimcordLogger } from "./logger";

const log = createWimcordLogger("ReleaseUpdater");

export interface WimcordReleaseManifest {
    version: string;
    notes?: string;
    publishedAt?: string;
    /** Release page or installer download */
    installerUrl?: string;
    /** Zip of dist/ for in-app apply (desktop) */
    downloadUrl?: string;
}

const DISMISSED_KEY = "Wimcord_dismissedRelease_v1";

interface GitHubReleaseJson {
    tag_name?: string;
    body?: string;
    published_at?: string;
    html_url?: string;
    assets?: Array<{ name?: string; browser_download_url?: string; }>;
}

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

function normalizeVersion(tag: string): string {
    return tag.replace(/^v/i, "").trim();
}

function pickAssetUrl(assets: GitHubReleaseJson["assets"], pattern: RegExp): string | undefined {
    return assets?.find(a => a.name && pattern.test(a.name))?.browser_download_url;
}

async function fetchFromGitHub(): Promise<WimcordReleaseManifest | null> {
    try {
        const res = await fetch(WIMCORD_GITHUB.releasesLatestApi, {
            cache: "no-store",
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": `Wimcord/${WIMCORD_BRAND.version}`,
            },
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const data = await res.json() as GitHubReleaseJson;
        const version = data.tag_name ? normalizeVersion(data.tag_name) : "";
        if (!version) return null;

        const assets = data.assets ?? [];
        const downloadUrl =
            pickAssetUrl(assets, /^wimcord-dist.*\.zip$/i)
            ?? pickAssetUrl(assets, /^dist-.*\.zip$/i)
            ?? pickAssetUrl(assets, /\.zip$/i);

        const installerExe = pickAssetUrl(assets, /^WimcordInstaller.*\.exe$/i);

        return {
            version,
            notes: data.body?.trim() || undefined,
            publishedAt: data.published_at,
            installerUrl: installerExe ?? data.html_url ?? WIMCORD_GITHUB.releasesPage,
            downloadUrl,
        };
    } catch (e) {
        log.warn("GitHub release check failed", e);
        return null;
    }
}

async function fetchCustomManifest(url: string): Promise<WimcordReleaseManifest | null> {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json() as WimcordReleaseManifest;
        if (!data?.version) return null;
        return {
            ...data,
            version: normalizeVersion(data.version),
            installerUrl: data.installerUrl ?? WIMCORD_GITHUB.releasesPage,
        };
    } catch (e) {
        log.warn("Custom release manifest failed", e);
        return null;
    }
}

/** Fetch latest release info (GitHub or custom manifest). Does not compare versions. */
export async function fetchWimcordRelease(): Promise<WimcordReleaseManifest | null> {
    await loadWimcordConfig();
    const custom = getWimcordConfigSync().updateManifestUrl?.trim();
    if (custom) return fetchCustomManifest(custom);
    return fetchFromGitHub();
}

/** Returns manifest only when a newer release exists and user has not dismissed it. */
export async function checkWimcordRelease(): Promise<WimcordReleaseManifest | null> {
    await loadWimcordConfig();
    if (!getWimcordConfigSync().updateNotificationsEnabled) return null;

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

export function getUpdateCheckIntervalMs(): number {
    const hours = getWimcordConfigSync().updateCheckIntervalHours;
    if (hours == null || hours <= 0) return 0;
    return hours * 60 * 60 * 1000;
}

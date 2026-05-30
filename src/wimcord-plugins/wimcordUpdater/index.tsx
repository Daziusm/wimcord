/*
 * Wimcord — release update notifier (GitHub Releases)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import {
    checkWimcordRelease,
    getUpdateCheckIntervalMs,
    type WimcordReleaseManifest,
} from "@wimcord-core/releaseUpdater";
import { WIMCORD_BRAND } from "@wimcord-core/branding";
import { recordDiagnostic } from "@wimcord-core/diagnostics";
import { onceReady } from "@webpack";

import { openWimcordReleaseModal } from "./ReleaseUpdateModal";

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastNotifiedVersion: string | null = null;

async function notifyIfUpdate(manifest: WimcordReleaseManifest) {
    if (lastNotifiedVersion === manifest.version) return;
    lastNotifiedVersion = manifest.version;

    recordDiagnostic("release-check", `New release ${manifest.version}`, { level: "info" });

    showNotification({
        title: `${WIMCORD_BRAND.name} ${manifest.version} is available`,
        body: manifest.notes?.slice(0, 120) ?? "Click to view update options.",
        permanent: true,
        onClick: () => openWimcordReleaseModal(manifest),
    });
}

async function runCheck() {
    const manifest = await checkWimcordRelease();
    if (manifest) await notifyIfUpdate(manifest);
}

export default definePlugin({
    name: "WimcordUpdater",
    description: "Notifies when a new Wimcord GitHub release is published",
    authors: [Devs.Wimcord],
    required: true,

    toolboxActions: {
        "Check for Wimcord updates": () => void runCheck(),
    },

    async start() {
        await onceReady;
        await runCheck();

        const ms = getUpdateCheckIntervalMs();
        if (ms > 0) {
            intervalId = setInterval(() => void runCheck(), ms);
        }
    },

    stop() {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
    },
});

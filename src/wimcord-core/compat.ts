/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getBuildNumber } from "@webpack/patcher";

import { WIMCORD_BRAND } from "./branding";
import { createWimcordLogger } from "./logger";
import type { WimcordCompatReport } from "./types";

const log = createWimcordLogger("Compat");

/** Known-good Discord build ranges (update when validating releases). */
const BUILD_MIN = 300000;
const BUILD_MAX = 999999;

export function checkCompatibility(): WimcordCompatReport {
    const warnings: string[] = [];
    const discordBuild = getBuildNumber();
    const vencordVersion = typeof VENCORD_VERSION !== "undefined" ? VENCORD_VERSION : "unknown";

    if (discordBuild < 0) {
        warnings.push("Could not detect Discord build number. Patches may not apply correctly.");
    } else if (discordBuild < BUILD_MIN || discordBuild > BUILD_MAX) {
        warnings.push(
            `Discord build ${discordBuild} is outside the validated range (${BUILD_MIN}–${BUILD_MAX}). ` +
            "Some Wimcord patches may no-op or fail gracefully."
        );
    }

    if (!IS_DISCORD_DESKTOP && !IS_WEB) {
        warnings.push("Unknown client environment. Desktop-specific features may be unavailable.");
    }

    const ok = warnings.length === 0;

    if (!ok) {
        for (const w of warnings) log.warn(w);
    } else {
        log.debug("Compatibility check passed", { discordBuild, vencordVersion });
    }

    return {
        discordBuild,
        vencordVersion,
        wimcordVersion: WIMCORD_BRAND.version,
        warnings,
        ok,
    };
}

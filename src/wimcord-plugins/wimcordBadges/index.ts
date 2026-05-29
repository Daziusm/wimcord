/*
 * Wimcord — custom badge loader (disables Vencord donor/contributor badges by default)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import Plugins from "~plugins";

import { startBadgeRegistrySync, stopBadgeRegistrySync } from "@wimcord-core/badgeRegistry";
import {
    disableVencordBadgeSources,
    loadWimcordBadgesFromStore,
} from "@wimcord-core/badges";
import { getWimcordConfigSync } from "@wimcord-core/config";
import { createWimcordLogger } from "@wimcord-core/logger";

const log = createWimcordLogger("BadgesPlugin");

export default definePlugin({
    name: "WimcordBadges",
    description: "Wimcord custom profile badges (replaces Vencord donor badge system)",
    authors: [Devs.Wimcord],
    required: true,

    async start() {
        await loadWimcordBadgesFromStore();
        await startBadgeRegistrySync();

        if (!getWimcordConfigSync().useVencordBadges) {
            disableVencordBadgeSources();
            const badgeApi = Plugins.BadgeAPI as { stop?: () => void } | undefined;
            badgeApi?.stop?.();
            log.info("Vencord badge sources disabled — using Wimcord badges only");
        }
    },

    stop() {
        stopBadgeRegistrySync();
    },
});

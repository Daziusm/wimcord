/*
 * Wimcord — optional network logging (off by default)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createWimcordLogger } from "@wimcord-core/logger";

import { markWimcordPluginStarted, shouldStartWimcordPlugin } from "../_shared/featureGate";

const log = createWimcordLogger("NetworkInspector");

let originalFetch: typeof fetch | null = null;

export default definePlugin({
    name: "WimcordNetworkInspector",
    description: "Logs fetch requests when enabled (never captures auth headers)",
    authors: [Devs.Wimcord],
    required: false,
    enabledByDefault: false,

    async start() {
        if (!await shouldStartWimcordPlugin("networkInspector")) return;
        markWimcordPluginStarted(this.name);

        if (originalFetch) return;
        originalFetch = window.fetch.bind(window);

        window.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const method = init?.method ?? "GET";

            if (!url.includes("/auth") && !url.includes("token")) {
                log.debug(`${method} ${url}`);
            }

            return originalFetch!(input, init);
        };
    },

    stop() {
        if (originalFetch) {
            window.fetch = originalFetch;
            originalFetch = null;
        }
    },
});

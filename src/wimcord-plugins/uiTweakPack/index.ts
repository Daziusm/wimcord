/*
 * Wimcord — minimal UI tweaks (CSS only, no deep patches)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import { markWimcordPluginStarted, shouldStartWimcordPlugin } from "../_shared/featureGate";

const STYLE_ID = "wimcord-ui-tweak-pack";

export default definePlugin({
    name: "WimcordUiTweakPack",
    description: "Subtle UI polish via CSS variables (plugin-gated)",
    authors: [Devs.Wimcord],
    required: false,
    enabledByDefault: false,

    async start() {
        if (!await shouldStartWimcordPlugin("uiTweakPack")) return;
        markWimcordPluginStarted(this.name);

        if (document.getElementById(STYLE_ID)) return;

        const el = document.createElement("style");
        el.id = STYLE_ID;
        el.textContent = `
            /* Wimcord UI tweak pack — minimal, reversible */
            [class*="messagesWrapper"] {
                scroll-behavior: smooth;
            }
            [class*="channelTextArea"] textarea {
                transition: border-color 0.15s ease;
            }
        `;
        document.head.appendChild(el);
    },

    stop() {
        document.getElementById(STYLE_ID)?.remove();
    },
});

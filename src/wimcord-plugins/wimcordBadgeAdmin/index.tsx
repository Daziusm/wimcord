/*
 * Wimcord Badge Admin — separate settings tab (allowlisted Discord user only)
 */

import { OwnerCrownIcon } from "@components/Icons";
import { wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { isWimcordBadgeAdmin } from "@wimcord-core/badgeAdmin";
import { onceReady } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

import BadgeAdminTab from "./BadgeAdminTab";
import { markWimcordPluginStarted } from "../_shared/featureGate";

const TAB_KEY = "wimcord_badge_admin";
const Tab = wrapTab(BadgeAdminTab, "Badge Admin");

function registerTab() {
    if (!isWimcordBadgeAdmin()) return;
    if (SettingsPlugin.customEntries.some(e => e.key === TAB_KEY)) return;

    SettingsPlugin.customEntries.push({
        key: TAB_KEY,
        title: "Badge Admin",
        panelTitle: "Wimcord Badge Admin",
        Component: Tab,
        Icon: OwnerCrownIcon,
    });
}

function unregisterTab() {
    removeFromArray(SettingsPlugin.customEntries, e => e.key === TAB_KEY);
}

export default definePlugin({
    name: "WimcordBadgeAdmin",
    description: "Badge registry admin panel (owner only)",
    authors: [Devs.Wimcord],
    required: true,

    start() {
        markWimcordPluginStarted(this.name);
        registerTab();
        void onceReady.then(registerTab);
        FluxDispatcher.subscribe("CONNECTION_OPEN", registerTab);
    },

    stop() {
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", registerTab);
        unregisterTab();
    },
});

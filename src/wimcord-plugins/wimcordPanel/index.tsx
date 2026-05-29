/*
 * Wimcord Panel — user settings
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Switch } from "@components/Switch";
import { MainSettingsIcon } from "@components/Icons";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

import { WIMCORD_BRAND } from "@wimcord-core/branding";
import { getFeatureToggles, getWimcordConfigSync, loadWimcordConfig, saveWimcordConfig, setFeatureEnabled } from "@wimcord-core/config";
import { getCurrentDiscordUserId, registerCurrentWimcordUser } from "@wimcord-core/badgeRegistry";
import { fetchWimcordRelease } from "@wimcord-core/releaseUpdater";
import { removeFromArray } from "@utils/misc";

import { markWimcordPluginStarted } from "../_shared/featureGate";

const settings = definePluginSettings({
    openOnStart: {
        type: OptionType.BOOLEAN,
        description: "Show Wimcord in settings",
        default: true,
    },
});

function WimcordPanelTab() {
    const [cfg, setCfg] = React.useState(getWimcordConfigSync());
    const refresh = async () => setCfg(await loadWimcordConfig());

    return (
        <SettingsTab>
            <HeadingSecondary>{WIMCORD_BRAND.settingsMainPanelTitle}</HeadingSecondary>
            <Paragraph>{WIMCORD_BRAND.tagline}</Paragraph>
            <Paragraph>Version {WIMCORD_BRAND.version}</Paragraph>

            <Divider />

            <HeadingSecondary>Features</HeadingSecondary>
            {getFeatureToggles().map(f => (
                <Switch
                    key={f.id}
                    value={cfg.features[f.id] ?? f.defaultEnabled}
                    onChange={async v => {
                        await setFeatureEnabled(f.id, v);
                        const { syncWimcordPluginEnables } = await import("@wimcord-core/pluginSync");
                        await syncWimcordPluginEnables();
                        await refresh();
                    }}
                    note={f.description}
                >
                    {f.label}
                </Switch>
            ))}

            <Divider />

            <HeadingSecondary>Badges</HeadingSecondary>
            <Switch
                value={cfg.useVencordBadges}
                onChange={async v => {
                    await saveWimcordConfig({ useVencordBadges: v });
                    await refresh();
                }}
                note="Off by default — Wimcord uses its own badge registry"
            >
                Show Vencord donor badges
            </Switch>
            <Switch
                value={cfg.badgeAutoRegister}
                onChange={async v => {
                    await saveWimcordConfig({ badgeAutoRegister: v });
                    await refresh();
                }}
                note="Sends only your Discord user id to the badge server — never your token"
            >
                Register for Wimcord User badge
            </Switch>
            <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                Your Discord id: {getCurrentDiscordUserId() ?? "not loaded yet"}
            </Paragraph>
            <Button
                style={{ marginTop: 8 }}
                onClick={async () => {
                    await registerCurrentWimcordUser();
                    await refresh();
                }}
            >
                Register badge now
            </Button>

            <Divider />

            <HeadingSecondary>Updates</HeadingSecondary>
            <Button
                onClick={async () => {
                    const m = await fetchWimcordRelease();
                    if (m) alert(`Remote version: ${m.version}\n${m.notes ?? ""}`);
                    else alert("No update available or manifest not configured.");
                }}
            >
                Check for updates
            </Button>

            <Divider />

            <HeadingSecondary>Diagnostics</HeadingSecondary>
            <Switch
                value={cfg.diagnosticsEnabled}
                onChange={async v => {
                    await saveWimcordConfig({ diagnosticsEnabled: v });
                    await refresh();
                }}
                note="Crash and error logging to a local file"
            >
                Enable diagnostics
            </Switch>
            <Switch
                value={cfg.diagnosticsPersistToDisk}
                onChange={async v => {
                    await saveWimcordConfig({ diagnosticsPersistToDisk: v });
                    await refresh();
                }}
                note="%AppData%/Vencord/wimcord-logs/diagnostics.log"
            >
                Save diagnostics to disk
            </Switch>
            {IS_DISCORD_DESKTOP && (
                <Button
                    style={{ marginTop: 8 }}
                    onClick={async () => {
                        const path = await VencordNative.wimcord.getLogPath();
                        VencordNative.native.openExternal(path.replace(/[^/\\]+$/, ""));
                    }}
                >
                    Open log folder
                </Button>
            )}
        </SettingsTab>
    );
}

const PanelTab = wrapTab(WimcordPanelTab, WIMCORD_BRAND.settingsMainPanelTitle);
const SETTINGS_KEY = "wimcord_panel";

export default definePlugin({
    name: "WimcordPanel",
    description: "Wimcord settings",
    authors: [Devs.Wimcord],
    required: true,
    settings,

    settingsAboutComponent: () => (
        <Paragraph>Open User Settings and search for &quot;Wimcord&quot;.</Paragraph>
    ),

    start() {
        markWimcordPluginStarted(this.name);
        SettingsPlugin.customEntries.push({
            key: SETTINGS_KEY,
            title: WIMCORD_BRAND.settingsSectionTitle,
            panelTitle: WIMCORD_BRAND.settingsMainPanelTitle,
            Component: PanelTab,
            Icon: MainSettingsIcon,
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === SETTINGS_KEY);
    },
});

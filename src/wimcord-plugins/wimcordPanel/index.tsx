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
import { getPatchHealthReport } from "@wimcord-core/patchHealth";
import { checkWimcordRelease, fetchWimcordRelease } from "@wimcord-core/releaseUpdater";
import { openWimcordReleaseModal } from "../wimcordUpdater/ReleaseUpdateModal";
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
    const [logPath, setLogPath] = React.useState<string | null>(null);
    const refresh = async () => setCfg(await loadWimcordConfig());

    React.useEffect(() => {
        if (!IS_DISCORD_DESKTOP) return;
        VencordNative.wimcord.getLogPath().then(setLogPath).catch(() => {});
    }, []);

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
            <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                Wimcord checks GitHub Releases automatically when you start Discord (and every few hours).
            </Paragraph>
            <Button
                style={{ marginTop: 8 }}
                onClick={async () => {
                    const newer = await checkWimcordRelease();
                    if (newer) {
                        openWimcordReleaseModal(newer);
                        return;
                    }
                    const latest = await fetchWimcordRelease();
                    if (latest && latest.version === WIMCORD_BRAND.version) {
                        alert(`You're on the latest release (${WIMCORD_BRAND.version}).`);
                    } else if (latest) {
                        alert(`Installed: ${WIMCORD_BRAND.version}\nLatest on GitHub: ${latest.version}`);
                    } else {
                        alert("Could not reach GitHub. Try again later.");
                    }
                }}
            >
                Check for updates
            </Button>

            <Divider />

            <HeadingSecondary>Diagnostics</HeadingSecondary>
            {(() => {
                const ph = getPatchHealthReport();
                if (!ph) return (
                    <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                        Patch health: not checked yet (open Discord fully).
                    </Paragraph>
                );
                return (
                    <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                        Patch health: {ph.ok ? "OK" : "degraded"}
                        {ph.safeModeActive ? " (safe mode on)" : ""}
                        {!ph.ok && (
                            <>
                                <br />
                                {ph.probableCause}
                            </>
                        )}
                    </Paragraph>
                );
            })()}
            <Switch
                value={cfg.safeModeOnPatchFailure}
                onChange={async v => {
                    await saveWimcordConfig({ safeModeOnPatchFailure: v });
                    await refresh();
                }}
                note="Off = always show title-bar buttons (CustomProfile, etc.) even if probes fail — may crash"
            >
                Safe mode on patch failure
            </Switch>
            <Paragraph style={{ fontSize: 12, opacity: 0.85 }}>
                CustomProfile and similar plugins add a button in Discord&apos;s top title bar. If that button is missing,
                check that the plugin is enabled under Settings → Plugins, then rebuild + repair. Safe mode only hides the bar when the injection patch truly fails.
            </Paragraph>
            <Switch
                value={cfg.patchHealthNotifyOnFailure}
                onChange={async v => {
                    await saveWimcordConfig({ patchHealthNotifyOnFailure: v });
                    await refresh();
                }}
                note="Show a warning modal when Discord is newer than this Wimcord build"
            >
                Warn when patches are stale
            </Switch>
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
                <>
                    {logPath ? (
                        <Paragraph style={{ fontSize: 12, opacity: 0.85, wordBreak: "break-all" }}>
                            Log file: {logPath}
                        </Paragraph>
                    ) : null}
                    <Button
                        style={{ marginTop: 8 }}
                        onClick={async () => {
                            const err = await VencordNative.wimcord.openLogFolder();
                            if (err) alert(`Could not open log folder: ${err}`);
                        }}
                    >
                        Open log folder
                    </Button>
                </>
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

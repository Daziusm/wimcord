/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const WIMCORD_BRAND = {
    name: "Wimcord",
    shortName: "Wimcord",
    tagline: "Stable, customizable Discord — built on Vencord",
    version: "0.1.1",

    /** User Settings sidebar section */
    settingsSectionTitle: "Wimcord",
    settingsSectionHeading: "Wimcord Settings",

    /** First tab under the section (core client options) */
    settingsMainEntryTitle: "General",
    settingsMainPanelTitle: "Wimcord Settings",

    /** Wimcord Panel plugin sidebar label */
    settingsDashboardTitle: "Wimcord",
    settingsDashboardPanelTitle: "Wimcord",

    updaterPanelTitle: "Wimcord Updater",
    cloudPanelTitle: "Wimcord Cloud",
    pluginsCategoryLabel: "Wimcord Plugins",

    /** Version row copied in Settings → bottom of client version */
    versionPrefix: "Wimcord",
    /** Internal API object name (plugins use Vencord.* — do not rename) */
    engineName: "Vencord",
} as const;

/** User-visible labels derived from brand */
export const WIMCORD_UI = {
    notificationsFrom: `${WIMCORD_BRAND.name} notifications`,
    notificationsSentBy: `Notifications sent by ${WIMCORD_BRAND.name}`,
    updateAvailable: `A ${WIMCORD_BRAND.name} update is available!`,
    updateComplete: `${WIMCORD_BRAND.name} has been updated!`,
    autoUpdateDescription: `Automatically update ${WIMCORD_BRAND.name} without confirmation prompt`,
    autoUpdateNotifyDescription: `Show a notification when ${WIMCORD_BRAND.name} automatically updates`,
    settingsLocationDescription: `Where to put the ${WIMCORD_BRAND.name} settings section`,
    versionInfoDescription: `Also copy ${WIMCORD_BRAND.name} info (${WIMCORD_BRAND.name}, Electron, Chromium) when clicking the version info in the bottom left area of the Settings page`,
    supportDonate: `Please consider supporting the development of ${WIMCORD_BRAND.name}!`,
    contribThanks: `Thank you for contributing to ${WIMCORD_BRAND.name}!`,
} as const;

export function displayName(forSettings = false): string {
    return forSettings ? WIMCORD_BRAND.settingsSectionTitle : WIMCORD_BRAND.name;
}

/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface WimcordFeatureToggle {
    id: string;
    label: string;
    description: string;
    defaultEnabled: boolean;
    /** When true, disabling requires restart */
    requiresRestart?: boolean;
}

export interface WimcordCompatReport {
    discordBuild: number;
    vencordVersion: string;
    wimcordVersion: string;
    warnings: string[];
    ok: boolean;
}

export interface WimcordRuntimeState {
    startedAt: number;
    devMode: boolean;
    pluginsLoaded: string[];
    patchCount: number;
    moduleCacheHits: number;
    moduleCacheMisses: number;
}

export type WimcordLifecyclePhase =
    | "pre-init"
    | "init"
    | "webpack-ready"
    | "dom-ready"
    | "shutdown";

export type WimcordLifecycleHook = (phase: WimcordLifecyclePhase) => void | Promise<void>;

export interface WimcordBadgeDefinition {
    id: string;
    description: string;
    iconSrc: string;
    /** Discord user snowflakes that receive this badge (local override; remote registry adds more) */
    userIds?: string[];
    link?: string;
    position?: import("@api/Badges").BadgePosition;
}

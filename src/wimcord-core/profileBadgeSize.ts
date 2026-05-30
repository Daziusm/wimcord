/*
 * Wimcord — profile popout badge display size (matches Discord ~18px badges)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Rendered size in the profile header / popout */
export const PROFILE_BADGE_DISPLAY_PX = 18;

/** Requested CDN dimension for badge icon assets */
export const PROFILE_BADGE_CDN_PX = 32;

export function profileBadgeDisplayStyle(
    extra?: Record<string, string | number | undefined>
): Record<string, string | number> {
    return {
        width: PROFILE_BADGE_DISPLAY_PX,
        height: PROFILE_BADGE_DISPLAY_PX,
        maxWidth: PROFILE_BADGE_DISPLAY_PX,
        maxHeight: PROFILE_BADGE_DISPLAY_PX,
        objectFit: "contain",
        flexShrink: 0,
        ...extra,
    };
}

/*
 * Wimcord — profile badge image with Discord CDN fallbacks
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { React } from "@webpack/common";

import { getBadgeIconFallbacks, resolveBadgeIconUrl } from "./badgeIconUrl";

type Props = ProfileBadge & BadgeUserArgs;

export function WimcordBadgeImage({ iconSrc, props: imgProps }: Props) {
    const primary = React.useMemo(() => resolveBadgeIconUrl(iconSrc ?? ""), [iconSrc]);
    const fallbacks = React.useMemo(() => getBadgeIconFallbacks(iconSrc ?? ""), [iconSrc]);
    const candidates = React.useMemo(() => [primary, ...fallbacks], [primary, fallbacks]);
    const [index, setIndex] = React.useState(0);
    const src = candidates[index] ?? primary;

    React.useEffect(() => {
        setIndex(0);
    }, [iconSrc]);

    if (!src) return null;

    return (
        <img
            alt=""
            aria-hidden
            src={src}
            {...imgProps}
            onError={() => {
                setIndex(i => (i + 1 < candidates.length ? i + 1 : i));
            }}
        />
    );
}

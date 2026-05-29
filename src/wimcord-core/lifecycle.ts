/*
 * Wimcord — structured Discord client mod (Vencord fork)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createWimcordLogger } from "./logger";
import type { WimcordLifecycleHook, WimcordLifecyclePhase } from "./types";

const log = createWimcordLogger("Lifecycle");
const hooks = new Map<WimcordLifecyclePhase, Set<WimcordLifecycleHook>>();

export function onWimcordPhase(phase: WimcordLifecyclePhase, hook: WimcordLifecycleHook) {
    if (!hooks.has(phase)) hooks.set(phase, new Set());
    hooks.get(phase)!.add(hook);
    return () => hooks.get(phase)?.delete(hook);
}

export async function emitWimcordPhase(phase: WimcordLifecyclePhase) {
    const set = hooks.get(phase);
    if (!set?.size) return;

    log.debug(`Phase: ${phase}`);
    for (const hook of set) {
        try {
            await hook(phase);
        } catch (e) {
            log.error(`Lifecycle hook failed (${phase})`, e);
        }
    }
}

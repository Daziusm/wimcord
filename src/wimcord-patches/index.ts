/*
 * Wimcord — patch registration (isolated from plugins)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { canonicalizeFind, canonicalizeReplacement } from "@utils/patches";
import { Patch } from "@utils/types";
import { patches } from "@webpack/patcher";

import { createWimcordLogger } from "@wimcord-core/logger";

import { wimcordCorePatches } from "./registry";

const log = createWimcordLogger("Patches");

export function registerWimcordPatches() {
    for (const raw of wimcordCorePatches) {
        const patch = { ...raw } as Patch;

        if (patch.predicate && !patch.predicate()) {
            log.debug(`Skipped patch (predicate): ${patch.plugin}`);
            continue;
        }

        canonicalizeFind(patch);
        if (!Array.isArray(patch.replacement)) {
            patch.replacement = [patch.replacement];
        }

        for (const replacement of patch.replacement) {
            canonicalizeReplacement(
                replacement,
                `Wimcord.patches[${JSON.stringify(patch.plugin)}]`
            );
        }

        patches.push(patch);
        log.debug(`Registered core patch: ${patch.plugin} → ${patch.find}`);
    }
}

export { wimcordCorePatches };

/*
 * Wimcord — core patches only (no plugin business logic)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Patch } from "@utils/types";

/**
 * Core Wimcord patches — minimal, version-guarded, reversible via no-op fallbacks.
 * UI copy is applied in source via @wimcord-core/branding (not Discord webpack).
 */
export const wimcordCorePatches: Patch[] = [];

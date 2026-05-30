/*
 * Wimcord — download and apply dist/ from a release zip (desktop auto-update)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { unzipSync } from "fflate";
import { ipcMain } from "electron";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { DATA_DIR } from "./utils/constants";

function stripZipRoot(path: string): string {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts[0] === "dist") parts.shift();
    if (parts[0]?.toLowerCase().startsWith("wimcord-dist")) parts.shift();
    return parts.join("/");
}

export function initWimcordUpdateIpc() {
    ipcMain.handle(IpcEvents.WIMCORD_APPLY_DIST_UPDATE, async (_, downloadUrl: string) => {
        if (!downloadUrl?.trim()) {
            return { ok: false as const, error: "No download URL" };
        }

        try {
            const res = await fetch(downloadUrl.trim(), {
                headers: { "User-Agent": "Wimcord-Updater" },
            });
            if (!res.ok) {
                return { ok: false as const, error: `Download failed: ${res.status} ${res.statusText}` };
            }

            const buf = Buffer.from(await res.arrayBuffer());
            const files = unzipSync(new Uint8Array(buf));
            const distDir = join(DATA_DIR, "dist");
            const tmpDir = join(DATA_DIR, "dist-update-staging");

            rmSync(tmpDir, { recursive: true, force: true });
            mkdirSync(tmpDir, { recursive: true });

            let count = 0;
            for (const [rawPath, data] of Object.entries(files)) {
                if (rawPath.endsWith("/")) continue;
                const rel = stripZipRoot(rawPath);
                if (!rel) continue;
                const out = join(tmpDir, rel);
                mkdirSync(dirname(out), { recursive: true });
                writeFileSync(out, data);
                count++;
            }

            if (count === 0) {
                return { ok: false as const, error: "Zip contained no files" };
            }

            rmSync(distDir, { recursive: true, force: true });
            renameSync(tmpDir, distDir);

            return { ok: true as const, files: count };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? String(e) };
        }
    });
}

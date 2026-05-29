/**
 * Resolve Wimcord root (dist/, scripts/) for dev vs packaged installer.
 */
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const INSTALLER_DIR = dirname(fileURLToPath(import.meta.url));

/** Folder containing installer UI, preload, etc. */
export function getInstallerAppDir() {
    return INSTALLER_DIR;
}

/** Repo root in dev; resources/wimcord when packaged. */
export function getWimcordRoot() {
    if (process.env.VENCORD_USER_DATA_DIR) {
        return process.env.VENCORD_USER_DATA_DIR;
    }
    if (process.env.WIMCORD_ROOT) {
        return process.env.WIMCORD_ROOT;
    }
    if (process.resourcesPath) {
        const bundled = join(process.resourcesPath, "wimcord");
        if (existsSync(join(bundled, "dist", "patcher.js"))) {
            return bundled;
        }
    }
    return join(INSTALLER_DIR, "..");
}

export function isPackagedInstaller() {
    return Boolean(
        process.env.WIMCORD_INSTALLER_PACKAGED === "1" ||
        (process.resourcesPath && existsSync(join(process.resourcesPath, "wimcord", "dist", "patcher.js")))
    );
}

export function ensureWimcordRootEnv() {
    const root = getWimcordRoot();
    process.env.VENCORD_USER_DATA_DIR = root;
    process.env.WIMCORD_ROOT = root;
    return root;
}

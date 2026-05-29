/**
 * Resolve Wimcord root (dist/, scripts/) for dev vs packaged installer.
 */
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const INSTALLER_DIR = dirname(fileURLToPath(import.meta.url));

/** Folder containing installer UI, preload, etc. */
export function getInstallerAppDir() {
    return INSTALLER_DIR;
}

/** Bundled or repo Wimcord build (patcher.js). May be read-only when packaged. */
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

/** Writable folder for patch handoff, results, and installer CLI cache (not inside resources/). */
export function getInstallerStateDir() {
    if (process.env.WIMCORD_INSTALLER_STATE_DIR) {
        return process.env.WIMCORD_INSTALLER_STATE_DIR;
    }
    if (isPackagedInstaller()) {
        const local =
            process.env.LOCALAPPDATA ||
            (process.platform === "win32" ? join(homedir(), "AppData", "Local") : join(homedir(), ".local", "share"));
        return join(local, "Wimcord", "installer");
    }
    return join(getWimcordRoot(), "dist", "installer-state");
}

export function ensureInstallerStateDir() {
    const dir = getInstallerStateDir();
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function getInstallerPatchRequestPath() {
    return join(ensureInstallerStateDir(), "patch-request.json");
}

export function getInstallerResultPath() {
    return join(ensureInstallerStateDir(), "result.json");
}

export function getInstallerSpawnCwd() {
    if (isPackagedInstaller() && process.execPath) {
        return dirname(process.execPath);
    }
    return getWimcordRoot();
}

export function ensureWimcordRootEnv() {
    const root = getWimcordRoot();
    const state = ensureInstallerStateDir();
    process.env.VENCORD_USER_DATA_DIR = root;
    process.env.WIMCORD_ROOT = root;
    process.env.WIMCORD_INSTALLER_STATE_DIR = state;
    return root;
}

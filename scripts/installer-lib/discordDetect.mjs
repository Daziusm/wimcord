import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

/** @typedef {"stable" | "ptb" | "canary" | "dev" | "custom"} DiscordBranch */

export const BRANCH_DIRS = {
    stable: "Discord",
    ptb: "DiscordPTB",
    canary: "DiscordCanary",
    dev: "DiscordDevelopment",
};

export const BRANCH_LABELS = {
    stable: "Stable",
    ptb: "PTB",
    canary: "Canary",
    dev: "Development",
    custom: "Custom",
};

const BRANCH_ORDER = ["stable", "ptb", "canary", "dev"];

/**
 * @param {string} basePath
 * @param {DiscordBranch} [branchHint]
 * @returns {import("./discordDetect.mjs").DiscordInstallInfo | null}
 */
export function parseDiscordInstall(basePath, branchHint = "") {
    if (!basePath || !existsSync(basePath)) return null;

    let entries;
    try {
        entries = readdirSync(basePath, { withFileTypes: true });
    } catch {
        return null;
    }

    let version = "";
    let patched = false;

    for (const ent of entries) {
        if (!ent.isDirectory() || !ent.name.startsWith("app-")) continue;
        const resources = join(basePath, ent.name, "resources");
        if (!existsSync(resources)) continue;
        const ver = ent.name.slice(4);
        if (!version || ent.name > `app-${version}`) {
            version = ver;
            patched = existsSync(join(resources, "_app.asar"));
        }
    }

    if (!version) return null;

    const branch = branchHint || inferBranchFromPath(basePath);
    return {
        branch,
        path: basePath,
        version,
        patched,
        label: BRANCH_LABELS[branch] ?? "Custom",
    };
}

/**
 * @param {string} p
 * @returns {DiscordBranch}
 */
function inferBranchFromPath(p) {
    const name = basename(p);
    for (const [branch, dir] of Object.entries(BRANCH_DIRS)) {
        if (name === dir) return /** @type {DiscordBranch} */ (branch);
    }
    return "custom";
}

/** @returns {import("./discordDetect.mjs").DiscordInstallInfo[]} */
export function findDiscordInstalls() {
    if (process.platform === "win32") {
        const local = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
        const installs = [];
        for (const branch of BRANCH_ORDER) {
            const inst = parseDiscordInstall(join(local, BRANCH_DIRS[branch]), branch);
            if (inst) installs.push(inst);
        }
        return installs;
    }

    if (process.platform === "darwin") {
        const base = join(homedir(), "Library", "Application Support");
        const installs = [];
        for (const branch of BRANCH_ORDER) {
            const inst = parseDiscordInstall(join(base, BRANCH_DIRS[branch]), branch);
            if (inst) installs.push(inst);
        }
        return installs;
    }

    const bases = [join(homedir(), ".local", "share"), "/usr/share", "/opt"];
    const installs = [];
    const seen = new Set();
    for (const base of bases) {
        let children;
        try {
            children = readdirSync(base, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const child of children) {
            if (!child.isDirectory()) continue;
            const name = child.name;
            if (!name.startsWith("discord") && !name.startsWith("Discord")) continue;
            const full = join(base, name);
            if (seen.has(full)) continue;
            const inst = parseDiscordInstall(full);
            if (inst) {
                seen.add(full);
                installs.push(inst);
            }
        }
    }
    return installs.sort((a, b) => BRANCH_ORDER.indexOf(a.branch) - BRANCH_ORDER.indexOf(b.branch));
}

/**
 * @param {import("./discordDetect.mjs").DiscordInstallInfo} install
 */
export function discordProcessName(install) {
    if (install.branch === "stable") return "Discord.exe";
    if (install.branch === "custom") {
        const base = basename(install.path);
        if (base === "Discord") return "Discord.exe";
        return `${base}.exe`;
    }
    const dir = BRANCH_DIRS[install.branch];
    return dir ? `${dir}.exe` : "Discord.exe";
}

/**
 * @param {import("./discordDetect.mjs").DiscordInstallInfo} install
 */
export function discordUpdateExe(install) {
    const updateExe = join(install.path, "Update.exe");
    if (existsSync(updateExe)) return updateExe;
    return null;
}

/** @returns {string | null} Path to the newest app-VERSION/resources folder */
export function getLatestResourcesDir(basePath) {
    if (!basePath || !existsSync(basePath)) return null;

    let latestDir = "";
    let resources = null;

    try {
        for (const ent of readdirSync(basePath, { withFileTypes: true })) {
            if (!ent.isDirectory() || !ent.name.startsWith("app-")) continue;
            const res = join(basePath, ent.name, "resources");
            if (!existsSync(res)) continue;
            if (!latestDir || ent.name > latestDir) {
                latestDir = ent.name;
                resources = res;
            }
        }
    } catch {
        return null;
    }

    return resources;
}

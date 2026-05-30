/**
 * Same-length patches on VencordInstaller.exe — UI text only, logic unchanged.
 */

/** @type {[string, string][]} */
export const INSTALLER_STRING_PATCHES = [
    ["VencordInstaller.exe", "WimcordInstaller.exe"],
    ["VencordInstallerCli.exe", "WimcordInstallerCli.exe"],
    ["VencordInstaller", "WimcordInstaller"],
    ["Vencord Installer", "Wimcord Installer"],
    ["Local Vencord Version", "Local Wimcord Version"],
    ["Latest Vencord Version", "Latest Wimcord Version"],
    ["Not updating Vencord due to being in DevMode", "Not updating Wimcord due to being in DevMode"],
    ["Failed to install the latest Vencord builds", "Failed to install the latest Wimcord builds"],
    [
        "Failed to install the latest Vencord builds from GitHub:",
        "Failed to install the latest Wimcord builds from GitHub:",
    ],
    ["Reinstall & Update Vencord", "Reinstall & Update Wimcord"],
    [
        "verify Vencord installed successfully by looking for its category in Discord Settings",
        "verify Wimcord installed successfully by looking for Wimcord in Plugins and Settings ",
    ],
    ["otherwise Vencord will likely not work", "otherwise Wimcord will likely not work"],
    ["An Installer for the Vencord Discord Mod", "An Installer for the Wimcord Discord Mod"],
    ['"CompanyName": "Vencord"', '"CompanyName": "Wimcord"'],
    ['"FileDescription": "Vencord Installer"', '"FileDescription": "Wimcord Installer"'],
    ['"ProductName": "Vencord Installer"', '"ProductName": "Wimcord Installer"'],
    [
        "**Github** and **vencord.dev** are the only official places to get Vencord. Any other site claiming to be us is malicious.",
        "**github.com/Daziusm/wimcord** is the only official source. Do not use fake repacks or random installers.                 ",
    ],
    [
        "If you downloaded from any other source, you should delete / uninstall everything immediately, run a malware scan and change your Discord password.",
        "If you got this from elsewhere, delete it, scan for malware, and download Wimcord only from github.com/Daziusm/wimcord please.                     ",
    ],
    [
        "To customise this location, set the environment variable 'VENCORD_USER_DATA_DIR' and restart me",
        "Set WIMCORD_USER_DATA_DIR for a custom folder, then restart the installer.                     ",
    ],
    ["Vencord is in no way affiliated with OpenAsar.", "Wimcord is in no way affiliated with OpenAsar."],
    [
        "Found existing Vencord Install. Checking for hash...",
        "Found existing Wimcord Install. Checking for hash...",
    ],
    ["Files will be downloaded to: ", "Wimcord uses this folder:    "],
    ["Dev Install: ", "Wimcord dev: "],
    ["https://vencord.dev/releases/vencord", "https://github.com/Daziusm/wimcord  "],
    ["https://vencord.dev/releases/installer", "https://github.com/Daziusm/wimcord/i  "],
];

function assertSameLength(from, to) {
    if (Buffer.byteLength(from) !== Buffer.byteLength(to)) {
        throw new Error(`Patch length mismatch (${from.length} vs ${to.length}): ${from.slice(0, 40)}…`);
    }
}

function replaceAll(haystack, needle, replacement) {
    const n = Buffer.from(needle);
    const r = Buffer.from(replacement);
    let count = 0;
    let i = 0;
    while (i <= haystack.length - n.length) {
        if (haystack.subarray(i, i + n.length).equals(n)) {
            r.copy(haystack, i);
            i += n.length;
            count++;
        } else {
            i++;
        }
    }
    return count;
}

function toUtf16LE(str) {
    const b = Buffer.alloc(str.length * 2);
    for (let i = 0; i < str.length; i++) {
        b.writeUInt16LE(str.charCodeAt(i), i * 2);
    }
    return b;
}

/**
 * @param {Buffer} buf
 * @returns {{ buf: Buffer, hits: number }}
 */
export function patchInstallerBranding(buf) {
    const out = Buffer.from(buf);
    let hits = 0;

    for (const [from, to] of INSTALLER_STRING_PATCHES) {
        assertSameLength(from, to);
        hits += replaceAll(out, from, to);
        hits += replaceAll(out, toUtf16LE(from), toUtf16LE(to));
    }

    return { buf: out, hits };
}

export function installerNeedsBrandingPatch(buf) {
    const markers = [
        "Vencord Installer",
        "vencord.dev",
        "Local Vencord Version",
        "places to get Vencord",
        "Not updating Vencord",
        "**Github** and **vencord.dev**",
    ];
    for (const m of markers) {
        if (buf.includes(Buffer.from(m)) || buf.includes(toUtf16LE(m))) return true;
    }
    return false;
}

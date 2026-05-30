#!/usr/bin/env node
/**
 * Build WimcordInstaller.exe (winexe launcher) from C# via csc.exe
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csSource = join(root, "installer", "launcher", "WimcordInstallerLauncher.cs");
const outArg = process.argv[2];

if (!outArg) {
    console.error("Usage: node scripts/build-wimcord-installer-launcher.mjs <output.exe>");
    process.exit(1);
}

const windir = process.env.WINDIR ?? "C:\\Windows";
const cscCandidates = [
    join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    join(windir, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
];

const csc = cscCandidates.find(p => existsSync(p));
if (!csc) {
    console.error("[Wimcord] csc.exe not found. Install .NET Framework developer pack or build on Windows.");
    process.exit(1);
}

mkdirSync(dirname(outArg), { recursive: true });

const compressionRefs = [
    join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "System.IO.Compression.dll"),
    join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "System.IO.Compression.FileSystem.dll"),
];

const refs = compressionRefs.filter(p => existsSync(p)).map(p => `/r:${p}`);

execFileSync(
    csc,
    [
        "/nologo",
        "/target:winexe",
        "/optimize+",
        ...refs,
        `/out:${outArg}`,
        csSource,
    ],
    { stdio: "inherit" }
);

console.log("[Wimcord] Launcher:", outArg);

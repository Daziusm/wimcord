import { dirname, join } from "path";
import { fileURLToPath } from "url";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/** Repo root (contains dist/, package.json). */
export function getWimcordRoot() {
    if (process.env.VENCORD_USER_DATA_DIR) return process.env.VENCORD_USER_DATA_DIR;
    if (process.env.WIMCORD_ROOT) return process.env.WIMCORD_ROOT;
    return join(LIB_DIR, "..", "..");
}

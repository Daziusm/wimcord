/*
 * Wimcord — safe serialization for log / diagnostic payloads
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const SEEN = new WeakSet<object>();

export function serializeForLog(value: unknown, depth = 0, maxDepth = 5): unknown {
    if (value === undefined) return undefined;
    if (value === null) return null;

    if (value instanceof Error) {
        const err = value as Error & { cause?: unknown; code?: unknown; };
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
            cause: err.cause !== undefined ? serializeForLog(err.cause, depth + 1, maxDepth) : undefined,
        };
    }

    if (typeof value === "bigint") return value.toString();
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (typeof value === "symbol") return value.toString();

    if (typeof value !== "object") return value;

    if (depth >= maxDepth) return "[MaxDepth]";

    if (SEEN.has(value)) return "[Circular]";
    SEEN.add(value);

    try {
        if (Array.isArray(value)) {
            return value.slice(0, 50).map(v => serializeForLog(v, depth + 1, maxDepth));
        }

        if (value instanceof Map) {
            const out: Record<string, unknown> = {};
            let i = 0;
            for (const [k, v] of value) {
                if (i++ >= 50) break;
                out[String(k)] = serializeForLog(v, depth + 1, maxDepth);
            }
            return out;
        }

        if (value instanceof Set) {
            return [...value].slice(0, 50).map(v => serializeForLog(v, depth + 1, maxDepth));
        }

        const out: Record<string, unknown> = {};
        let i = 0;
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (i++ >= 80) break;
            out[k] = serializeForLog(v, depth + 1, maxDepth);
        }
        return out;
    } finally {
        SEEN.delete(value);
    }
}

export function formatConsoleArgs(args: unknown[]): unknown {
    if (args.length === 0) return "";
    if (args.length === 1) return serializeForLog(args[0]);
    return args.map(a => serializeForLog(a));
}

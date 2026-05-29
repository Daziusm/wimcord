/*
 * Wimcord — structured debug log overlay
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createRoot, React, useEffect, useState } from "@webpack/common";
import type { Root } from "react-dom/client";

import { getWimcordLogBuffer } from "@wimcord-core/logger";
import { getWimcordConfigSync } from "@wimcord-core/config";

import { markWimcordPluginStarted, shouldStartWimcordPlugin } from "../_shared/featureGate";

function DebugConsoleOverlay() {
    const [entries, setEntries] = useState(() => [...getWimcordLogBuffer()]);
    const devMode = getWimcordConfigSync().devMode;

    useEffect(() => {
        const id = setInterval(() => setEntries([...getWimcordLogBuffer()]), 1000);
        return () => clearInterval(id);
    }, []);

    if (!devMode && entries.length === 0) return null;

    const visible = entries.slice(-24);

    return (
        <div
            style={{
                position: "fixed",
                top: 48,
                left: 12,
                zIndex: 99998,
                width: 420,
                maxHeight: 240,
                overflow: "auto",
                padding: 8,
                borderRadius: 8,
                fontSize: 10,
                fontFamily: "var(--font-code)",
                background: "rgba(0,0,0,0.75)",
                color: "#c0caf5",
                pointerEvents: "none",
            }}
        >
            {visible.map((e, i) => (
                <div key={`${e.ts}-${i}`} style={{ marginBottom: 4 }}>
                    <span style={{ color: "#7aa2f7" }}>[{e.scope}]</span>{" "}
                    <span style={{ opacity: 0.7 }}>{e.level}</span> {e.message}
                </div>
            ))}
        </div>
    );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export default definePlugin({
    name: "WimcordDebugConsole",
    description: "Structured Wimcord log overlay (enable dev mode for verbose output)",
    authors: [Devs.Wimcord],
    required: false,
    enabledByDefault: false,

    async start() {
        if (!await shouldStartWimcordPlugin("debugConsole")) return;
        markWimcordPluginStarted(this.name);

        container = document.createElement("div");
        container.id = "wimcord-debug-console";
        document.body.appendChild(container);
        root = createRoot(container);
        root.render(<DebugConsoleOverlay />);
    },

    stop() {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
    },
});

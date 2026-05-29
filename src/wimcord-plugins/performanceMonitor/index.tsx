/*
 * Wimcord — performance monitor overlay
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createRoot, React, useEffect, useState } from "@webpack/common";
import type { Root } from "react-dom/client";

import { markWimcordPluginStarted, shouldStartWimcordPlugin } from "../_shared/featureGate";

function PerfOverlay() {
    const [fps, setFps] = useState(0);
    const [mem, setMem] = useState<number | null>(null);

    useEffect(() => {
        let frames = 0;
        let last = performance.now();
        let raf = 0;

        const tick = (now: number) => {
            frames++;
            if (now - last >= 1000) {
                setFps(frames);
                frames = 0;
                last = now;
                const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
                setMem(perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null);
            }
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                bottom: 12,
                right: 12,
                zIndex: 99999,
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "var(--font-code)",
                background: "var(--background-floating)",
                color: "var(--text-normal)",
                boxShadow: "var(--elevation-high)",
                pointerEvents: "none",
                opacity: 0.92,
            }}
        >
            {fps} FPS{mem != null ? ` · ${mem} MB` : ""}
        </div>
    );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

export default definePlugin({
    name: "WimcordPerformanceMonitor",
    description: "Lightweight FPS and memory overlay",
    authors: [Devs.Wimcord],
    required: false,
    enabledByDefault: false,

    async start() {
        if (!await shouldStartWimcordPlugin("performanceMonitor")) return;
        markWimcordPluginStarted(this.name);

        container = document.createElement("div");
        container.id = "wimcord-perf-monitor";
        document.body.appendChild(container);
        root = createRoot(container);
        root.render(<PerfOverlay />);
    },

    stop() {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
    },
});

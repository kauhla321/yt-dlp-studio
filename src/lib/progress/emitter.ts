import { EventEmitter } from "node:events";
import type { ProgressSnapshot } from "@/types";

/**
 * A process-wide event bus that fans out progress snapshots to any number of
 * SSE subscribers. Stored on globalThis so it survives Next.js module
 * reloads in dev and is shared across all route handler invocations.
 */
class ProgressBus extends EventEmitter {
  publish(snap: ProgressSnapshot) {
    this.emit("progress", snap);
  }
}

const KEY = "__ytp_progress_bus__";
const g = globalThis as unknown as Record<string, ProgressBus | undefined>;

export const progressBus: ProgressBus = g[KEY] ?? (g[KEY] = new ProgressBus());
// Allow many concurrent SSE connections without warnings.
progressBus.setMaxListeners(0);

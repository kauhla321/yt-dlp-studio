"use client";

// App-wide tool status store — single source of truth for the Sidebar status
// panel, the home-screen SystemBanner and the Settings installer section.
//
// Previously each consumer ran its own copy of useTools:
//  - The layout sidebar probed once at mount and never learned about installs
//    finished elsewhere → "Setup Required" stayed stuck until app restart.
//  - The Settings poll loop stopped the moment the server reported "done",
//    without waiting for the system probe to confirm the binary actually runs.
//    A brand-new exe can fail its first probe (Defender scan / PyInstaller
//    first-run extraction can exceed the probe timeout), so the UI froze on
//    "not found" until the section was remounted by navigation.
//
// This module owns one shared state + one polling loop. Consumers subscribe
// with useSyncExternalStore. After the server reports "done" the loop keeps
// polling until the tool is verified available (with a grace deadline), so
// transient first-run probe failures self-heal instead of freezing the UI.

import { api } from "@/lib/client";
import type { SystemStatus, ToolInstallStatus, ToolName } from "@/types";

export interface ToolsState {
  system: SystemStatus | null;
  installs: Record<ToolName, ToolInstallStatus> | null;
  /** Tool whose install this client started and is polling (single-flight). */
  installing: ToolName | null;
  /** Set when an install finished but the binary could not be verified in time. */
  verificationError: { tool: ToolName; message: string } | null;
}

const IDLE: ToolsState = {
  system: null,
  installs: null,
  installing: null,
  verificationError: null,
};

let state: ToolsState = IDLE;
const listeners = new Set<() => void>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let ticking = false;
let verifyDeadline = 0; // grace period after "done" to confirm availability
let installDeadline = 0; // overall cap for the whole install+verify flow

const POLL_MS = 1_000;
const VERIFY_GRACE_MS = 45_000;
const INSTALL_CAP_MS = 10 * 60_000;

function publish(next: ToolsState) {
  state = next;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureVisibilityRefresh();
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ToolsState {
  return state;
}

let initialized = false;

/** Probe once per app session; the store stays warm across navigations. */
export function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  void refresh();
}

/**
 * Fresh probe + install states from the server. Keeps a pending verification
 * error only while the tool is still undetectable; once it becomes available
 * the error is cleared so a working tool is never shown with a stale warning.
 */
export async function refresh(): Promise<SystemStatus | null> {
  try {
    const res = await api.tools();
    publish({
      ...state,
      system: res.system,
      installs: res.installs,
      verificationError:
        state.verificationError &&
        !res.system[state.verificationError.tool].available
          ? state.verificationError
          : null,
    });
    return res.system;
  } catch {
    publish({ ...state, system: null });
    return null;
  }
}

/** Start (or no-op if already running) an install and poll it to completion. */
export async function install(tool: ToolName): Promise<void> {
  stopPolling();
  // Optimistic busy state: the spinner appears immediately, even before the
  // first poll response arrives.
  publish({ ...state, installing: tool, verificationError: null });
  try {
    await api.installTool(tool);
  } catch {
    /* install errors surface through the polled status */
  }
  verifyDeadline = Date.now() + VERIFY_GRACE_MS;
  installDeadline = Date.now() + INSTALL_CAP_MS;
  pollTimer = setInterval(tick, POLL_MS);
  void tick();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (state.installing) {
    publish({ ...state, installing: null });
  }
}

const TOOL_LABEL: Record<ToolName, string> = { ytdlp: "yt-dlp", ffmpeg: "ffmpeg" };

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const res = await api.tools();
    if (res) {
      publish({
        ...state,
        system: res.system,
        installs: res.installs,
        verificationError:
          state.verificationError &&
          !res.system[state.verificationError.tool].available
            ? state.verificationError
            : null,
      });
    }

    const tool = state.installing;
    if (!tool) return; // loop was stopped while a request was in flight
    const st = res?.installs?.[tool]?.state;
    if (!res || !st) return; // transient fetch failure → keep polling

    const available =
      tool === "ytdlp" ? res.system.ytdlp.available : res.system.ffmpeg.available;

    if (st === "error") {
      // Error message already lives in installs[tool].message (shared state).
      stopPolling();
    } else if (st === "done" && available) {
      stopPolling();
    } else if (st === "done" && !available) {
      if (Date.now() > verifyDeadline) {
        // Downloaded, but the binary never showed up in a probe. Surface it
        // instead of freezing on "not found" forever.
        stopPolling();
        publish({
          ...state,
          verificationError: {
            tool,
            message: `${TOOL_LABEL[tool]} was downloaded but could not be verified. Click Update to retry, or restart the app.`,
          },
        });
      }
      // else: keep polling; the next probe may succeed (Defender scan done).
    } else if (Date.now() > installDeadline) {
      stopPolling();
      publish({
        ...state,
        verificationError: {
          tool,
          message: `Installing ${TOOL_LABEL[tool]} did not complete. Check the connection and try again.`,
        },
      });
    }
  } finally {
    ticking = false;
  }
}

// Safety net: re-probe when the window regains focus, so the status panels
// catch up after any external change (e.g. a binary placed next to the app).
let visibilityAttached = false;
function ensureVisibilityRefresh() {
  if (visibilityAttached || typeof document === "undefined") return;
  visibilityAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !state.installing) void refresh();
  });
}

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  ensureInitialized,
  refresh,
  install as installTool,
} from "@/lib/tools/status-store";
import type { ToolName } from "@/types";

/**
 * Shared tool-status hook: reads the app-wide tool store (one probe + one
 * install poll loop shared by the Sidebar, SystemBanner and ToolsSection), so
 * an install started anywhere is visible everywhere without navigation or an
 * app restart.
 */
export function useTools(onReady?: () => void) {
  // getSnapshot doubles as the server snapshot: the store is module state
  // without DOM access, so SSR renders the neutral "checking" state and the
  // first client effect kicks off the probe.
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Probe once per app session; the store stays warm across navigations.
  useEffect(() => {
    ensureInitialized();
  }, []);

  // Notify callers when the install they were watching settles (done/error).
  const prevInstalling = useRef<ToolName | null>(state.installing);
  useEffect(() => {
    if (prevInstalling.current && !state.installing && onReady) onReady();
    prevInstalling.current = state.installing;
  }, [state.installing, onReady]);

  return {
    system: state.system,
    installs: state.installs,
    /** Tool currently being installed (shared across all consumers). */
    installing: state.installing,
    /** Client-side verification failure (downloaded but never detected). */
    verificationError: state.verificationError,
    refresh,
    install: installTool,
  };
}

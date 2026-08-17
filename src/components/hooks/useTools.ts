"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { SystemStatus, ToolInstallStatus, ToolName } from "@/types";

/**
 * Shared tool-status hook: tracks system probe + per-tool install progress,
 * and starts/polls installs. Used by the system banner and settings page.
 */
export function useTools(onReady?: () => void) {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [installs, setInstalls] = useState<Record<ToolName, ToolInstallStatus> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.tools();
      setSystem(res.system);
      setInstalls(res.installs);
      return res;
    } catch {
      setSystem(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const install = useCallback(
    async (tool: ToolName) => {
      try {
        await api.installTool(tool);
      } catch {
        /* errors surface via polled status */
      }
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const res = await refresh();
        const st = res?.installs[tool].state;
        if (st === "done" || st === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (st === "done") onReady?.();
        }
      }, 1000);
    },
    [refresh, onReady]
  );

  return { system, installs, refresh, install };
}

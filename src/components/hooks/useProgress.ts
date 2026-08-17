"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressSnapshot } from "@/types";

/**
 * Subscribe to the global SSE progress stream and maintain a map of the
 * latest snapshot per jobId. One EventSource is shared for the whole app;
 * it auto-reconnects on drop (native EventSource behaviour), so progress
 * survives transient network hiccups and browser tab refreshes.
 */
export function useProgress(): {
  snapshots: Record<string, ProgressSnapshot>;
} {
  const [snapshots, setSnapshots] = useState<Record<string, ProgressSnapshot>>({});
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/progress");
    sourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const snap = JSON.parse(evt.data) as ProgressSnapshot;
        setSnapshots((prev) => ({ ...prev, [snap.jobId]: snap }));
      } catch {
        // ignore malformed frame
      }
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, []);

  return { snapshots };
}

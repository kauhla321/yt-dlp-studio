"use client";

import { cn } from "./ui/primitives";
import type { JobStatus } from "@/types";

const TONE: Record<string, string> = {
  downloading: "bg-accent",
  processing: "bg-info",
  completed: "bg-accent",
  failed: "bg-danger",
  interrupted: "bg-warn",
  canceled: "bg-ink-faint",
  queued: "bg-ink-faint",
};

export function ProgressBar({
  percent,
  status,
}: {
  percent: number;
  status: JobStatus;
}) {
  const active = status === "downloading" || status === "processing";
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-panel2"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-full transition-[width] duration-500 ease-out",
          TONE[status] ?? "bg-accent",
          active && "animate-pulse-bar"
        )}
        style={{ width: `${clamped}%` }}
      >
        {active && <span className="progress-sheen" />}
      </div>
    </div>
  );
}

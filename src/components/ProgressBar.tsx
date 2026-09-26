"use client";

import type { JobStatus } from "@/types";

const FILL: Record<JobStatus, string> = {
  downloading: "#6cb6ff",
  processing: "#b18cff",
  completed: "#5fd38d",
  failed: "#ff6b6b",
  interrupted: "#ffcf56",
  canceled: "#3a3a3a",
  queued: "#262626",
};

export function ProgressBar({
  percent,
  status,
}: {
  percent: number;
  status: JobStatus;
}) {
  const active = status === "downloading" || status === "processing";
  // Processing (ffmpeg post-step) has no meaningful percent — show a full bar.
  const clamped = status === "processing" || status === "completed" ? 100 : Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative h-1 w-full overflow-hidden rounded-full bg-[#262626]"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: FILL[status] }}
      >
        {active && <span className="progress-sheen" />}
      </div>
    </div>
  );
}

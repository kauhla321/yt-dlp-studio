"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { ProgressBar } from "./ProgressBar";
import { cn } from "./ui/primitives";
import { XIcon, VideoCamIcon, NoteIcon, SubsGlyphIcon, PlaylistIcon, ExclaimIcon } from "./ui/icons";
import type { DownloadType, JobStatus, ProgressSnapshot, QueueJob } from "@/types";

const STATUS_WORD: Record<JobStatus, string> = {
  queued: "queued",
  downloading: "downloading",
  processing: "processing",
  completed: "done",
  failed: "failed",
  interrupted: "interrupted",
  canceled: "canceled",
};

const STATUS_COLOR: Record<JobStatus, string> = {
  queued: "#8a8a8a",
  downloading: "#6cb6ff",
  processing: "#b18cff",
  completed: "#5fd38d",
  failed: "#ff6b6b",
  interrupted: "#ffcf56",
  canceled: "#8a8a8a",
};

const TYPE_TINT: Record<DownloadType, { bg: string; fg: string; Icon: typeof VideoCamIcon }> = {
  video: { bg: "#3a2e0a", fg: "#ffcf56", Icon: VideoCamIcon },
  audio: { bg: "#2a1f45", fg: "#b18cff", Icon: NoteIcon },
  subtitles: { bg: "#0f2940", fg: "#6cb6ff", Icon: SubsGlyphIcon },
  playlist: { bg: "#1f1f1f", fg: "#e1e1e1", Icon: PlaylistIcon },
};

export function DownloadQueue({
  jobs,
  snapshots,
  onCancel,
}: {
  jobs: QueueJob[];
  snapshots: Record<string, ProgressSnapshot>;
  onCancel: (id: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = async (id: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // Clipboard can be unavailable in some embedded contexts; ignore.
    }
  };

  const openFolder = (dir: string) => {
    void api.openPath(dir).catch(() => {});
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-control border border-dashed border-[#2b2b2b] px-4 py-3.5 text-center text-[12.5px] text-ink-muted">
        nothing queued yet. analyze a url and start a download to see live progress here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-1.5">
      {jobs.map((job, i) => {
        const snap = snapshots[job.id] ?? job.progress;
        const status = snap.status ?? job.status;
        const active = status === "downloading" || status === "processing";
        const tint = status === "failed" ? { bg: "#3a1414", fg: "#ff6b6b", Icon: ExclaimIcon } : TYPE_TINT[job.request.type];
        const Icon = tint.Icon;
        const chip = snap.playlistTotal
          ? `${snap.playlistIndex ?? 0}/${snap.playlistTotal}`
          : job.request.qualityLabel ?? (job.request.type === "audio" ? job.request.audioFormat : undefined);

        return (
          <div key={job.id} className={cn("flex flex-col gap-2 p-3", i > 0 && "border-t border-raised")}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                style={{ background: tint.bg, color: tint.fg }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {job.request.title || job.request.url}
              </span>
              {chip && <span className="rounded-[6px] bg-raised px-1.5 py-px text-[11px] text-ink-muted">{chip}</span>}
              {active ? (
                <span className="text-xs" style={{ color: STATUS_COLOR[status] }}>
                  {Math.round(snap.percent)}%
                </span>
              ) : (
                <span className="text-xs" style={{ color: STATUS_COLOR[status] }}>
                  {STATUS_WORD[status]}
                </span>
              )}
              {status === "completed" && (
                <button
                  type="button"
                  onClick={() => openFolder(job.outputDir)}
                  className="h-7 shrink-0 cursor-pointer rounded-[8px] bg-raised px-2.5 text-xs text-ink"
                >
                  open
                </button>
              )}
              {job.command && (
                <button
                  type="button"
                  onClick={() => copyCommand(job.id, job.command!)}
                  className="h-7 shrink-0 cursor-pointer rounded-[8px] px-2.5 text-xs text-ink-muted hover:text-ink"
                >
                  {copiedId === job.id ? "copied!" : "copy cmd"}
                </button>
              )}
              {(active || status === "queued") && (
                <button
                  type="button"
                  aria-label="cancel"
                  onClick={() => onCancel(job.id)}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-ink-muted hover:text-ink"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <ProgressBar percent={snap.percent} status={status} />

            {status === "queued" ? (
              <div className="text-[11px] text-ink-faint">waiting for a free slot</div>
            ) : status === "completed" ? (
              <>
                <div className="truncate text-[11px] text-ink-faint">{job.outputDir}</div>
                {job.command && (
                  <div className="truncate text-[11px] text-ink-dim" title={job.command}>
                    $ {job.command}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 text-[11px] text-ink-faint">
                <span className="truncate">{snap.currentFile ?? ""}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {snap.speed && <span>{snap.speed}</span>}
                  {snap.eta && <span>eta {snap.eta}</span>}
                </span>
              </div>
            )}

            {status === "failed" && (job.error || snap.error) && (
              <div role="alert" className="rounded-[9px] bg-danger-bg px-3 py-2.5 text-xs leading-relaxed">
                <span className="text-danger-text">{job.error ?? snap.error}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

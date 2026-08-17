"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { ProgressBar } from "./ProgressBar";
import { Badge, Button, cn } from "./ui/primitives";
import { XIcon, CheckIcon, AlertIcon, LoaderIcon, CopyIcon, FolderIcon } from "./ui/icons";
import type { JobStatus, ProgressSnapshot, QueueJob } from "@/types";

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  downloading: "Downloading",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  interrupted: "Interrupted",
  canceled: "Canceled",
};

function statusTone(s: JobStatus): "neutral" | "success" | "warn" | "danger" | "info" {
  if (s === "completed") return "success";
  if (s === "failed") return "danger";
  if (s === "interrupted") return "warn";
  if (s === "downloading" || s === "processing") return "info";
  return "neutral";
}

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
      <div className="panel flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-sm font-medium text-ink-muted">No active downloads</p>
        <p className="text-xs text-ink-faint">
          Analyze a URL and start a download to see live progress here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const snap = snapshots[job.id] ?? job.progress;
        const status = snap.status ?? job.status;
        const active = status === "downloading" || status === "processing";
        return (
          <div key={job.id} className="panel animate-fade-in p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {job.request.title || job.request.url}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={statusTone(status)}>
                    {active && <LoaderIcon className="h-3 w-3" />}
                    {status === "completed" && <CheckIcon className="h-3 w-3" />}
                    {(status === "failed" || status === "interrupted") && (
                      <AlertIcon className="h-3 w-3" />
                    )}
                    {STATUS_LABEL[status]}
                  </Badge>
                  <Badge tone="neutral">{job.request.type}</Badge>
                  {job.request.qualityLabel && (
                    <Badge tone="neutral">{job.request.qualityLabel}</Badge>
                  )}
                  {snap.playlistTotal ? (
                    <Badge tone="neutral">
                      {snap.playlistIndex ?? 0}/{snap.playlistTotal}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {status === "completed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<FolderIcon className="h-4 w-4" />}
                    onClick={() => openFolder(job.outputDir)}
                    aria-label="Open output folder"
                  >
                    Open
                  </Button>
                )}
                {job.command && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<CopyIcon className="h-4 w-4" />}
                    onClick={() => copyCommand(job.id, job.command!)}
                    aria-label="Copy yt-dlp command"
                  >
                    {copiedId === job.id ? "Copied!" : "Copy"}
                  </Button>
                )}
                {active || status === "queued" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<XIcon className="h-4 w-4" />}
                    onClick={() => onCancel(job.id)}
                    aria-label="Cancel download"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>

            <ProgressBar percent={snap.percent} status={status} />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-muted">
              <span className="truncate">{snap.currentFile ?? job.outputDir}</span>
              <span className="flex shrink-0 items-center gap-3">
                {snap.speed && <span>{snap.speed}</span>}
                {snap.eta && <span>ETA {snap.eta}</span>}
                <span className={cn(active && "text-ink")}>{Math.round(snap.percent)}%</span>
              </span>
            </div>

            {status === "completed" && job.command && (
              <p className="mt-2 truncate font-mono text-[10px] text-ink-faint" title={job.command}>
                {job.command}
              </p>
            )}

            {status === "failed" && (job.error || snap.error) && (
              <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {job.error ?? snap.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

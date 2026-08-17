"use client";

import { Button } from "./ui/primitives";
import { ProgressBar } from "./ProgressBar";
import { useTools } from "./hooks/useTools";
import { AlertIcon, CheckIcon, DownloadIcon } from "./ui/icons";
import type { ToolName } from "@/types";

export function SystemBanner({ onReady }: { onReady?: () => void } = {}) {
  const { system, installs, installing, verificationError, install } = useTools(onReady);

  if (!system) {
    return null;
  }

  const missing: { tool: ToolName; label: string; reason: string }[] = [];
  if (!system.ytdlp.available) {
    missing.push({
      tool: "ytdlp",
      label: "yt-dlp",
      reason: "Required to analyze and download anything.",
    });
  }
  if (!system.ffmpeg.available) {
    missing.push({
      tool: "ffmpeg",
      label: "ffmpeg",
      reason: "Required for audio extraction and merging video quality.",
    });
  }

  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
        <CheckIcon className="h-4 w-4 shrink-0" />
        <span>
          Environment ready · yt-dlp {system.ytdlp.version ?? "?"} ({system.ytdlp.source})
          {system.ffmpeg.version ? ` · ffmpeg ${system.ffmpeg.version}` : ""}
          {system.firefox.available ? " · Firefox detected" : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
      <p className="break-all font-mono text-[11px] text-ink-faint">Tools folder: {system.binDir}</p>
      {missing.map(({ tool, label, reason }) => {
        const st = installs?.[tool];
        const busy =
          installing === tool ||
          st?.state === "downloading" ||
          st?.state === "extracting";
        const errored = st?.state === "error";
        return (
          <div key={tool} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2 text-sm text-warn">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">{label}</span> not found. {reason}
                </span>
              </div>
              {system.canInstall ? (
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() => install(tool)}
                  icon={!busy && <DownloadIcon className="h-4 w-4" />}
                >
                  {busy ? st?.message ?? "Installing…" : `Install ${label}`}
                </Button>
              ) : (
                <span className="text-xs text-ink-muted">Install manually (non-Windows)</span>
              )}
            </div>
            {busy && (
              <div>
                <ProgressBar percent={st?.percent ?? 0} status="downloading" />
                <p className="mt-1 text-[11px] text-ink-muted">{st?.message}</p>
              </div>
            )}
            {errored && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{st?.message}</p>
            )}
            {verificationError?.tool === tool && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {verificationError.message}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

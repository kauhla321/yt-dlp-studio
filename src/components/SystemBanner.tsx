"use client";

import { Button } from "./ui/primitives";
import { ProgressBar } from "./ProgressBar";
import { useTools } from "./hooks/useTools";
import { ExclaimIcon } from "./ui/icons";
import type { ToolName } from "@/types";

/**
 * Amber "setup required" box shown on the Download screen when a tool is
 * missing. Renders nothing once tools are ready — the sidebar's "tools ok"
 * tile and the footer version line cover that state instead.
 */
export function SystemBanner({ onReady }: { onReady?: () => void } = {}) {
  const { system, installs, installing, verificationError, install } = useTools(onReady);

  if (!system) return null;

  const missing: { tool: ToolName; label: string; reason: string }[] = [];
  if (!system.ytdlp.available) {
    missing.push({
      tool: "ytdlp",
      label: "yt-dlp",
      reason: "required to analyze and download anything.",
    });
  }
  if (!system.ffmpeg.available) {
    missing.push({
      tool: "ffmpeg",
      label: "ffmpeg",
      reason: "needed for audio extraction and merging video quality.",
    });
  }

  if (missing.length === 0) return null;

  return (
    <section aria-label="setup required" className="flex flex-col gap-2.5 rounded-card border border-warn-border bg-warn-bg p-4">
      {missing.map(({ tool, label, reason }) => {
        const st = installs?.[tool];
        const busy = installing === tool || st?.state === "downloading" || st?.state === "extracting";
        const errored = st?.state === "error";
        return (
          <div key={tool} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-video-tint text-video">
                <ExclaimIcon className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{label} is missing</span>
                <span className="text-xs text-ink-muted">{reason}</span>
              </div>
              {system.canInstall ? (
                busy ? (
                  <span className="text-xs text-video">{st?.message ?? "installing…"}</span>
                ) : (
                  <Button size="sm" onClick={() => install(tool)}>
                    install {label}
                  </Button>
                )
              ) : (
                <span className="text-xs text-ink-muted">install manually (non-windows)</span>
              )}
            </div>
            {busy && <ProgressBar percent={st?.percent ?? 0} status="interrupted" />}
            {errored && (
              <p className="rounded-control bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-text">
                {st?.message}
              </p>
            )}
            {verificationError?.tool === tool && (
              <p className="rounded-control bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-text">
                {verificationError.message}
              </p>
            )}
          </div>
        );
      })}
      <p className="break-all text-[11px] text-ink-faint">
        tools folder: {system.binDir} · also shown in the sidebar and settings
      </p>
    </section>
  );
}

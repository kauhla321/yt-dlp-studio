"use client";

import { Button, cn } from "./ui/primitives";
import { ProgressBar } from "./ProgressBar";
import { useTools } from "./hooks/useTools";
import type { ToolName } from "@/types";

export function ToolsSection() {
  const { system, installs, installing, verificationError, install } = useTools();

  // Never collapse to nothing — the binary installer must always be reachable
  // from Settings, even while the first probe is in flight.
  if (!system) {
    return (
      <section aria-label="tools" className="flex flex-col gap-2 rounded-card bg-surface p-1.5">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </section>
    );
  }

  const rows: { tool: ToolName; label: string; available: boolean; version?: string; source: string }[] = [
    {
      tool: "ytdlp",
      label: "yt-dlp",
      available: system.ytdlp.available,
      version: system.ytdlp.version,
      source: system.ytdlp.source === "local" ? "app folder" : system.ytdlp.source === "path" ? "system path" : "not found",
    },
    {
      tool: "ffmpeg",
      label: "ffmpeg",
      available: system.ffmpeg.available,
      version: system.ffmpeg.version,
      source: system.ffmpeg.source === "local" ? "app folder" : system.ffmpeg.source === "path" ? "system path" : "not found",
    },
  ];

  return (
    <section aria-label="tools" className="flex flex-col rounded-card bg-surface p-1.5">
      {rows.map((r, i) => {
        const st = installs?.[r.tool];
        const busy = installing === r.tool || st?.state === "downloading" || st?.state === "extracting";
        return (
          <div key={r.tool} className={cn("flex flex-col gap-2 p-3", i > 0 && "border-t border-raised")}>
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: r.available ? "#5fd38d" : "#ffcf56" }}
              />
              <span className="w-[70px] shrink-0 text-sm font-semibold">{r.label}</span>
              <span className="flex-1 text-xs text-ink-muted">
                {r.available ? `${r.version ?? "installed"} · ${r.source}` : "not found"}
              </span>
              {system.canInstall ? (
                <Button size="sm" variant="secondary" loading={busy} onClick={() => install(r.tool)}>
                  {busy ? st?.message ?? "working…" : r.available ? "update" : `install ${r.label}`}
                </Button>
              ) : (
                <span className="text-xs text-ink-muted">install manually</span>
              )}
            </div>
            {busy && (
              <div className="flex flex-col gap-1">
                <ProgressBar percent={st?.percent ?? 0} status="interrupted" />
                <p className="text-[11px] text-ink-muted">{st?.message}</p>
              </div>
            )}
            {st?.state === "error" && (
              <p className="rounded-control bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-text">
                {st.message}
              </p>
            )}
            {verificationError?.tool === r.tool && (
              <p className="rounded-control bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-text">
                {verificationError.message}
              </p>
            )}
          </div>
        );
      })}
      <div className={cn("flex items-center gap-3 p-3", rows.length > 0 && "border-t border-raised")}>
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: system.firefox.available ? "#5fd38d" : "#8a8a8a" }}
        />
        <span className="w-[70px] shrink-0 text-sm font-semibold">firefox</span>
        <span className="flex-1 text-xs text-ink-muted">
          {system.firefox.available ? "profile detected · used only for cookies" : "not found"}
        </span>
      </div>
      <p className="border-t border-raised px-3 pb-2 pt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        folder: {system.binDir} (next to the app). tools are looked for here first, then on your
        system path. install and update always save the latest build here. automatic install is
        windows-only.
      </p>
    </section>
  );
}

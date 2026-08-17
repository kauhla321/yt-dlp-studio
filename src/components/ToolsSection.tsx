"use client";

import { Button, Badge, SectionTitle } from "./ui/primitives";
import { ProgressBar } from "./ProgressBar";
import { useTools } from "./hooks/useTools";
import { TerminalIcon, DownloadIcon, RefreshIcon, CheckIcon } from "./ui/icons";
import type { ToolName } from "@/types";

export function ToolsSection() {
  const { system, installs, install } = useTools();

  // Never collapse to nothing — the binary installer must always be reachable
  // from Settings, even while the first probe is in flight.
  if (!system) {
    return (
      <section className="panel p-5">
        <SectionTitle
          icon={<TerminalIcon className="h-4 w-4" />}
          title="Binary Tools"
          hint="checking your system…"
        />
        <div className="space-y-3">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      </section>
    );
  }

  const rows: { tool: ToolName; label: string; available: boolean; version?: string; source: string }[] = [
    {
      tool: "ytdlp",
      label: "yt-dlp",
      available: system.ytdlp.available,
      version: system.ytdlp.version,
      source: system.ytdlp.source,
    },
    {
      tool: "ffmpeg",
      label: "ffmpeg",
      available: system.ffmpeg.available,
      version: system.ffmpeg.version,
      source: system.ffmpeg.source,
    },
  ];

  return (
    <section className="panel p-5">
      <SectionTitle
        icon={<TerminalIcon className="h-4 w-4" />}
        title="Binary Tools"
        hint="installs into the app folder"
      />
      <p className="mb-3 break-all font-mono text-[11px] text-ink-faint">Folder: {system.binDir}</p>

      <div className="space-y-3">
        {rows.map((r) => {
          const st = installs?.[r.tool];
          const busy = st?.state === "downloading" || st?.state === "extracting";
          return (
            <div key={r.tool} className="rounded-xl border border-border bg-canvas/50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{r.label}</span>
                  {r.available ? (
                    <Badge tone="success">
                      <CheckIcon className="h-3 w-3" />
                      {r.version ?? "installed"} · {r.source}
                    </Badge>
                  ) : (
                    <Badge tone="warn">not found</Badge>
                  )}
                </div>
                {system.canInstall ? (
                  <Button
                    size="sm"
                    variant={r.available ? "secondary" : "primary"}
                    loading={busy}
                    onClick={() => install(r.tool)}
                    icon={
                      !busy &&
                      (r.available ? (
                        <RefreshIcon className="h-4 w-4" />
                      ) : (
                        <DownloadIcon className="h-4 w-4" />
                      ))
                    }
                  >
                    {busy
                      ? st?.message ?? "Working…"
                      : r.available
                        ? "Update"
                        : `Install ${r.label}`}
                  </Button>
                ) : (
                  <span className="text-xs text-ink-muted">Install manually</span>
                )}
              </div>
              {busy && (
                <div className="mt-2">
                  <ProgressBar percent={st?.percent ?? 0} status="downloading" />
                  <p className="mt-1 text-[11px] text-ink-muted">{st?.message}</p>
                </div>
              )}
              {st?.state === "error" && (
                <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                  {st.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Tools are looked for next to the app first, then on your system PATH. Update and Install
        save the latest build into the app&apos;s folder shown above.
      </p>
    </section>
  );
}

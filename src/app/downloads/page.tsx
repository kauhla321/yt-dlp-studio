"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, cn } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ProgressBar";
import { RefreshIcon, PlayIcon, VideoCamIcon, NoteIcon, SubsGlyphIcon, PlaylistIcon } from "@/components/ui/icons";
import type { DownloadType, HistoryEntry, PlaylistState } from "@/types";

const TYPE_TINT: Record<DownloadType, { bg: string; fg: string; Icon: typeof VideoCamIcon }> = {
  video: { bg: "#3a2e0a", fg: "#ffcf56", Icon: VideoCamIcon },
  audio: { bg: "#2a1f45", fg: "#b18cff", Icon: NoteIcon },
  subtitles: { bg: "#0f2940", fg: "#6cb6ff", Icon: SubsGlyphIcon },
  playlist: { bg: "#1f1f1f", fg: "#e1e1e1", Icon: PlaylistIcon },
};

const STATUS_COLOR: Record<string, string> = {
  completed: "#5fd38d",
  failed: "#ff6b6b",
  interrupted: "#ffcf56",
};

export default function DownloadsPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistState[]>([]);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, p] = await Promise.all([api.history(), api.playlists()]);
      setHistory(h.entries);
      setPlaylists(p.playlists);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const interrupted = playlists.filter((p) => p.status === "interrupted");

  const resume = async (id: string) => {
    setResuming(id);
    try {
      await api.resumePlaylist(id);
      window.location.href = "/";
    } catch {
      setResuming(null);
    }
  };

  /** Re-run a failed download using the request saved in its history entry. */
  const retry = async (entry: HistoryEntry) => {
    if (!entry.request) return;
    setRetrying(entry.id);
    try {
      await api.download(entry.request);
      window.location.href = "/";
    } catch {
      setRetrying(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col items-center px-4 py-9">
      <div className="flex w-full max-w-[760px] flex-col gap-2.5">
        <header className="flex items-center justify-between px-1 pb-1">
          <h1 className="text-[22px] font-semibold">library</h1>
          <Button variant="secondary" icon={<RefreshIcon className="h-3.5 w-3.5" />} onClick={load}>
            refresh
          </Button>
        </header>

        {interrupted.length > 0 && (
          <>
            <div className="px-1 text-[13px] font-semibold">resume</div>
            <div className="flex flex-col gap-2.5">
              {interrupted.map((p) => {
                const remaining = Math.max(0, p.total - p.completed);
                const pct = p.total > 0 ? (p.completed / p.total) * 100 : 0;
                return (
                  <article key={p.id} className="flex flex-col gap-3 rounded-card border border-warn-border bg-warn-bg p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-video-tint text-video">
                        <PlaylistIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{p.title}</span>
                        <span className="text-xs text-ink-muted">
                          {p.completed} of {p.total || "?"} done · {remaining} left · interrupted{" "}
                          {new Date(p.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ProgressBar percent={pct} status="interrupted" />
                    <div className="flex gap-2">
                      <Button icon={<PlayIcon className="h-3 w-3" />} loading={resuming === p.id} onClick={() => resume(p.id)}>
                        resume
                      </Button>
                      <Link href="/">
                        <Button variant="secondary">start over</Button>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-2 flex items-baseline justify-between px-1">
          <span className="text-[13px] font-semibold">history</span>
          {history.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                await api.clearHistory();
                load();
              }}
              className="h-7 cursor-pointer rounded-[8px] px-2 text-xs text-ink-muted hover:text-ink"
            >
              clear all
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-control border border-dashed border-[#2b2b2b] p-6 text-center text-[12.5px] text-ink-muted">
            nothing here yet.
          </div>
        ) : (
          <div className="flex flex-col rounded-card bg-surface p-1.5">
            {history.map((h, i) => (
              <HistoryRow key={h.id} entry={h} divider={i > 0} retrying={retrying === h.id} onRetry={() => retry(h)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  divider,
  retrying,
  onRetry,
}: {
  entry: HistoryEntry;
  divider: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const tint = TYPE_TINT[entry.type];
  const Icon = tint.Icon;
  const meta = [
    entry.type,
    new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      new Date(entry.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    entry.playlistTotal != null ? `${entry.playlistCompleted ?? 0}/${entry.playlistTotal} items` : null,
    entry.outputLocation,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex min-h-16 items-center gap-3 px-3 py-2.5", divider && "border-t border-raised")}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: tint.bg, color: tint.fg }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium">{entry.title}</span>
        <span className="truncate text-[11.5px] text-ink-faint">{meta}</span>
      </div>
      <span className="w-[84px] shrink-0 text-xs" style={{ color: STATUS_COLOR[entry.status] }}>
        {entry.status}
      </span>
      <div className="flex w-[130px] shrink-0 justify-end gap-1">
        {entry.status === "failed" && entry.request && (
          <Button size="xs" loading={retrying} onClick={onRetry}>
            retry
          </Button>
        )}
        <Button size="xs" variant="secondary" onClick={() => void api.openPath(entry.outputLocation).catch(() => {})}>
          open
        </Button>
      </div>
    </div>
  );
}

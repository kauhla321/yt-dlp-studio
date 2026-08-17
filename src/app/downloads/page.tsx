"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Badge, cn } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ProgressBar";
import {
  RefreshIcon,
  TrashIcon,
  FolderIcon,
  CheckIcon,
  AlertIcon,
  PlayIcon,
} from "@/components/ui/icons";
import type { HistoryEntry, PlaylistState } from "@/types";

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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-salmon">Library</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Download history and resumable playlists.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshIcon className="h-4 w-4" />} onClick={load}>
          Refresh
        </Button>
      </header>

      {/* Resume section */}
      {interrupted.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">Resume playlists</h2>
          <div className="space-y-3">
            {interrupted.map((p) => {
              const remaining = Math.max(0, p.total - p.completed);
              const pct = p.total > 0 ? (p.completed / p.total) * 100 : 0;
              return (
                <div key={p.id} className="panel p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {p.completed} of {p.total || "?"} completed
                        {p.total ? ` · ${remaining} remaining` : ""}
                      </p>
                    </div>
                    <Badge tone="warn">
                      <AlertIcon className="h-3 w-3" /> Interrupted
                    </Badge>
                  </div>
                  <ProgressBar percent={pct} status="interrupted" />
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      icon={<PlayIcon className="h-4 w-4" />}
                      loading={resuming === p.id}
                      onClick={() => resume(p.id)}
                    >
                      Resume Download
                    </Button>
                    <Link href="/">
                      <Button size="sm" variant="ghost">
                        Start Over
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">History</h2>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={async () => {
                await api.clearHistory();
                load();
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : history.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-sm text-ink-muted">No downloads yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} retrying={retrying === h.id} onRetry={() => retry(h)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryRow({
  entry,
  retrying,
  onRetry,
}: {
  entry: HistoryEntry;
  retrying: boolean;
  onRetry: () => void;
}) {
  const tone =
    entry.status === "completed" ? "success" : entry.status === "failed" ? "danger" : "warn";
  return (
    <div className="panel flex items-center gap-3 p-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{entry.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span>{new Date(entry.date).toLocaleString()}</span>
          <span className="inline-flex items-center gap-1">
            <FolderIcon className="h-3 w-3" />
            <span className="max-w-[18rem] truncate font-mono">{entry.outputLocation}</span>
          </span>
          {entry.playlistTotal != null && (
            <span>
              {entry.playlistCompleted ?? 0}/{entry.playlistTotal} items
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {entry.status === "failed" && entry.request && (
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshIcon className="h-3.5 w-3.5" />}
            loading={retrying}
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={<FolderIcon className="h-3.5 w-3.5" />}
          onClick={() => void api.openPath(entry.outputLocation).catch(() => {})}
        >
          Open
        </Button>
      </div>
      <Badge tone="neutral">{entry.type}</Badge>
      <Badge tone={tone}>
        {entry.status === "completed" ? (
          <CheckIcon className="h-3 w-3" />
        ) : (
          <AlertIcon className="h-3 w-3" />
        )}
        <span className={cn("capitalize")}>{entry.status}</span>
      </Badge>
    </div>
  );
}

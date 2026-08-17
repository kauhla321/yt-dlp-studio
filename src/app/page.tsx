"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useProgress } from "@/components/hooks/useProgress";
import { SystemBanner } from "@/components/SystemBanner";
import { MetadataCard } from "@/components/MetadataCard";
import { VideoOptions } from "@/components/VideoOptions";
import { AudioOptions } from "@/components/AudioOptions";
import { SubtitleOptions, type SubtitleConfig } from "@/components/SubtitleOptions";
import { PlaylistPanel, type PlaylistMode } from "@/components/PlaylistPanel";
import { DownloadQueue } from "@/components/DownloadQueue";
import { Button, Toggle, Badge } from "@/components/ui/primitives";
import { SearchIcon, DownloadIcon, AlertIcon, RefreshIcon } from "@/components/ui/icons";
import { isValidUrl } from "@/lib/utils/sanitize";
import type {
  AnalysisResult,
  AudioFormat,
  DownloadRequest,
  PlaylistState,
  QueueJob,
  VideoQualityOption,
} from "@/types";

type Primary =
  | { type: "video"; quality: VideoQualityOption }
  | { type: "audio"; format: AudioFormat }
  | { type: "subtitles" };

// Persist the download screen across route changes (Next.js unmounts the page
// when navigating to Settings, which would otherwise clear the entered URL and
// analysis). sessionStorage keeps it for the browser session.
const STORE_KEY = "ytp_home_state_v1";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [cookieMode, setCookieMode] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<{ msg: string; hint?: string } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [primary, setPrimary] = useState<Primary | null>(null);
  const [subConfig, setSubConfig] = useState<SubtitleConfig>({
    langs: [],
    includeAuto: false,
    convertToSrt: true,
    embed: false,
  });
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode>({ kind: "best" });

  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [starting, setStarting] = useState(false);
  const [resumable, setResumable] = useState<PlaylistState[]>([]);

  const { snapshots } = useProgress();

  // Restore the screen (url + analysis + selection) from a previous visit, then
  // mirror changes back so navigating away and returning keeps everything.
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          url?: string;
          analysis?: AnalysisResult | null;
          primary?: Primary | null;
          subConfig?: SubtitleConfig;
          playlistMode?: PlaylistMode;
        };
        if (s.url) setUrl(s.url);
        if (s.analysis) setAnalysis(s.analysis);
        if (s.primary) setPrimary(s.primary);
        if (s.subConfig) setSubConfig(s.subConfig);
        if (s.playlistMode) setPlaylistMode(s.playlistMode);
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    hydrated.current = true;
  }, []);

  // The cached analysis can go stale (formats change); refresh it silently in
  // the background once per visit and preserve a still-valid selection.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!hydrated.current || refreshedRef.current) return;
    if (!analysis || !isValidUrl(url)) return;
    refreshedRef.current = true;
    void api
      .analyze(url.trim(), cookieMode)
      .then((result) => {
        setAnalysis(result);
        if (result.metadata.kind === "playlist") {
          setPlaylistMode({ kind: "best" });
          return;
        }
        // Drop the quality selection only if the picked stream vanished.
        if (
          primary?.type === "video" &&
          !result.videoQualities.some((q) => q.id === primary.quality.id)
        ) {
          setPrimary(null);
        }
      })
      .catch(() => {
        // Keep the cached analysis on failure — it is better than nothing.
      });
  }, [analysis, url, cookieMode, primary]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ url, analysis, primary, subConfig, playlistMode })
      );
    } catch {
      /* ignore quota/unavailable storage */
    }
  }, [url, analysis, primary, subConfig, playlistMode]);

  // Initial load: settings (cookie default), jobs, resumable playlists.
  useEffect(() => {
    api.settings().then((s) => setCookieMode(s.cookieModeDefault)).catch(() => {});
    refreshJobs();
    api
      .playlists()
      .then((r) => setResumable(r.playlists.filter((p) => p.status === "interrupted")))
      .catch(() => {});
  }, []);

  const refreshJobs = useCallback(() => {
    api.jobs().then((r) => setJobs(r.jobs)).catch(() => {});
  }, []);

  // Poll job list so completions / new jobs are reflected (progress comes via SSE).
  useEffect(() => {
    const id = setInterval(refreshJobs, 2500);
    return () => clearInterval(id);
  }, [refreshJobs]);

  const isPlaylist = analysis?.metadata.kind === "playlist";

  const handleAnalyze = useCallback(async () => {
    if (!isValidUrl(url)) {
      setAnalyzeError({ msg: "Please enter a valid http(s) URL." });
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setPrimary(null);
    try {
      const result = await api.analyze(url.trim(), cookieMode);
      setAnalysis(result);
      // Sensible defaults.
      if (result.metadata.kind === "video" && result.videoQualities.length > 0) {
        setPrimary({ type: "video", quality: result.videoQualities[0]! });
      } else if (result.metadata.kind === "playlist") {
        setPlaylistMode({ kind: "best" });
      }
    } catch (err) {
      const e = err as Error & { hint?: string };
      setAnalyzeError({ msg: e.message, hint: e.hint });
    } finally {
      setAnalyzing(false);
    }
  }, [url, cookieMode]);

  const buildRequest = useCallback((): DownloadRequest | null => {
    if (!analysis) return null;
    const base = {
      url: analysis.metadata.webpageUrl || url.trim(),
      title: analysis.metadata.title,
      cookieMode,
    };

    if (analysis.metadata.kind === "playlist") {
      if (playlistMode.kind === "best") {
        return { ...base, kind: "playlist", type: "playlist", formatSelector: "bv*+ba/b" };
      }
      return { ...base, kind: "playlist", type: "audio", audioFormat: playlistMode.format };
    }

    // Single video
    if (!primary) return null;
    const subs =
      subConfig.langs.length > 0 || subConfig.embed || primary.type === "subtitles"
        ? {
            langs: subConfig.langs,
            includeAuto: subConfig.includeAuto,
            convertToSrt: subConfig.convertToSrt,
            subtitlesOnly: primary.type === "subtitles",
            embed: subConfig.embed && primary.type === "video",
          }
        : undefined;

    if (primary.type === "video") {
      return {
        ...base,
        kind: "video",
        type: "video",
        formatSelector: primary.quality.formatSelector,
        mergeFormat: primary.quality.mergeFormat,
        qualityLabel: primary.quality.label,
        subtitles: subs,
      };
    }
    if (primary.type === "audio") {
      return { ...base, kind: "video", type: "audio", audioFormat: primary.format };
    }
    return { ...base, kind: "video", type: "subtitles", subtitles: subs };
  }, [analysis, primary, subConfig, playlistMode, cookieMode, url]);

  const canDownload = useMemo(() => {
    if (!analysis) return false;
    if (isPlaylist) return true;
    if (!primary) return false;
    if (primary.type === "subtitles" && subConfig.langs.length === 0) return false;
    return true;
  }, [analysis, isPlaylist, primary, subConfig.langs.length]);

  const handleDownload = useCallback(async () => {
    const req = buildRequest();
    if (!req) return;
    setStarting(true);
    try {
      await api.download(req);
      refreshJobs();
    } catch (err) {
      setAnalyzeError({ msg: (err as Error).message, hint: (err as Error & { hint?: string }).hint });
    } finally {
      setStarting(false);
    }
  }, [buildRequest, refreshJobs]);

  const handleCancel = useCallback(
    (id: string) => {
      api.cancel(id).then(refreshJobs).catch(() => {});
    },
    [refreshJobs]
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-salmon">Download</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Paste a video or playlist URL, analyze it, then choose how to download.
        </p>
      </header>

      <div className="mb-4">
        <SystemBanner />
      </div>

      {resumable.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-warn">
            <AlertIcon className="h-4 w-4 shrink-0" />
            <span>
              {resumable.length} interrupted playlist
              {resumable.length === 1 ? "" : "s"} can be resumed.
            </span>
          </div>
          <Link href="/downloads">
            <Button size="sm" variant="secondary" icon={<RefreshIcon className="h-4 w-4" />}>
              Go to Library
            </Button>
          </Link>
        </div>
      )}

      {/* URL bar */}
      <div className="panel p-4 sm:p-5">
        <label htmlFor="url" className="mb-2 block text-xs font-medium text-ink-muted">
          Video or playlist URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="url"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="input-field flex-1 font-mono"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              loading={analyzing}
              icon={!analyzing && <SearchIcon className="h-4 w-4" />}
              className="flex-1 sm:flex-none"
            >
              Analyze
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownload}
              loading={starting}
              disabled={!canDownload}
              icon={!starting && <DownloadIcon className="h-4 w-4" />}
              className="flex-1 sm:flex-none"
            >
              Download
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Toggle
            id="cookie-mode"
            checked={cookieMode}
            onChange={setCookieMode}
            label="Cookie Mode"
            description="Use cookies from Mozilla Firefox for authenticated, age-restricted, or private downloads (--cookies-from-browser firefox)."
          />
        </div>

        {analyzeError && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-danger">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{analyzeError.msg}</p>
                {analyzeError.hint && (
                  <p className="mt-1 text-xs text-danger/80">{analyzeError.hint}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analyzing skeleton */}
      {analyzing && (
        <div className="mt-4 space-y-3">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      )}

      {/* Results */}
      {analysis && !analyzing && (
        <div className="stagger mt-4 space-y-4">
          <MetadataCard meta={analysis.metadata} />

          {isPlaylist ? (
            <PlaylistPanel
              count={analysis.metadata.playlistCount}
              mode={playlistMode}
              onChange={setPlaylistMode}
            />
          ) : (
            <>
              <VideoOptions
                qualities={analysis.videoQualities}
                selectedId={primary?.type === "video" ? primary.quality.id : null}
                onSelect={(q) => setPrimary({ type: "video", quality: q })}
              />
              <AudioOptions
                selected={primary?.type === "audio" ? primary.format : null}
                onSelect={(f) => setPrimary({ type: "audio", format: f })}
                estimatedBytes={analysis.audioEstimatedBytes}
              />
              <SubtitleOptions
                tracks={analysis.subtitles}
                config={subConfig}
                onChange={setSubConfig}
                subtitlesOnly={primary?.type === "subtitles"}
                onSubtitlesOnly={() => setPrimary({ type: "subtitles" })}
                disabled={primary?.type === "audio"}
              />
            </>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel2/40 px-4 py-3">
            <p className="text-xs text-ink-muted">
              {selectionSummary(isPlaylist, primary, playlistMode, subConfig)}
            </p>
            <Button
              onClick={handleDownload}
              loading={starting}
              disabled={!canDownload}
              icon={!starting && <DownloadIcon className="h-4 w-4" />}
            >
              Start download
            </Button>
          </div>
        </div>
      )}

      {/* Active queue */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Downloads</h2>
          {jobs.length > 0 && <Badge tone="neutral">{jobs.length}</Badge>}
        </div>
        <DownloadQueue jobs={jobs} snapshots={snapshots} onCancel={handleCancel} />
      </section>
    </div>
  );
}

function selectionSummary(
  isPlaylist: boolean,
  primary: Primary | null,
  playlistMode: PlaylistMode,
  subs: SubtitleConfig
): string {
  if (isPlaylist) {
    return playlistMode.kind === "best"
      ? "Will download the best video+audio for every item."
      : `Will extract ${playlistMode.format.toUpperCase()} audio for every item.`;
  }
  if (!primary) return "Select a video quality, audio format, or subtitles to continue.";
  if (primary.type === "video") {
    const extra = subs.langs.length > 0 ? ` + ${subs.langs.length} subtitle track(s)` : "";
    return `Will download ${primary.quality.label} ${primary.quality.container.toUpperCase()} video${subs.embed ? " (embedded subs)" : ""}${extra}.`;
  }
  if (primary.type === "audio") return `Will extract ${primary.format.toUpperCase()} audio.`;
  return subs.langs.length > 0
    ? `Will download subtitles only (${subs.langs.join(", ")}).`
    : "Select at least one subtitle language.";
}

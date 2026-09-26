"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "@/components/hooks/useProgress";
import { useTools } from "@/components/hooks/useTools";
import { api } from "@/lib/client";
import { SystemBanner } from "@/components/SystemBanner";
import { MetadataCard } from "@/components/MetadataCard";
import { VideoOptions } from "@/components/VideoOptions";
import { AudioOptions } from "@/components/AudioOptions";
import { SubtitleOptions, type SubtitleConfig } from "@/components/SubtitleOptions";
import { PlaylistPanel, type PlaylistMode } from "@/components/PlaylistPanel";
import { DownloadQueue } from "@/components/DownloadQueue";
import { ReadyCard, type PrimarySelection } from "@/components/CommandPreview";
import { Button, IconButton, cn } from "@/components/ui/primitives";
import { SearchIcon, AlertIcon, ArrowDownIcon, XIcon } from "@/components/ui/icons";
import { isValidUrl } from "@/lib/utils/sanitize";
import type {
  AnalysisResult,
  AudioFormat,
  DownloadRequest,
  PlaylistState,
  QueueJob,
  VideoQualityOption,
} from "@/types";

type Mode = "video" | "audio" | "subs";

// Persist the download screen across route changes (Next.js unmounts the page
// when navigating to Settings, which would otherwise clear the entered URL and
// analysis). sessionStorage keeps it for the browser session.
const STORE_KEY = "ytp_home_state_v1";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [cookieMode, setCookieMode] = useState(false);
  const [mode, setMode] = useState<Mode>("video");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<{ msg: string; hint?: string } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [primary, setPrimary] = useState<PrimarySelection | null>(null);
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
  const [outputDirs, setOutputDirs] = useState({ video: "", playlist: "" });

  const { snapshots } = useProgress();
  const { system } = useTools();

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
          primary?: PrimarySelection | null;
          subConfig?: SubtitleConfig;
          playlistMode?: PlaylistMode;
          mode?: Mode;
        };
        if (s.url) setUrl(s.url);
        if (s.analysis) setAnalysis(s.analysis);
        if (s.primary) setPrimary(s.primary);
        if (s.subConfig) setSubConfig(s.subConfig);
        if (s.playlistMode) setPlaylistMode(s.playlistMode);
        if (s.mode) setMode(s.mode);
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
        JSON.stringify({ url, analysis, primary, subConfig, playlistMode, mode })
      );
    } catch {
      /* ignore quota/unavailable storage */
    }
  }, [url, analysis, primary, subConfig, playlistMode, mode]);

  // Initial load: settings (cookie default + output dirs), jobs, resumable playlists.
  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setCookieMode(s.cookieModeDefault);
        setOutputDirs({ video: s.videoOutputDir, playlist: s.playlistOutputDir });
      })
      .catch(() => {});
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
      setAnalyzeError({ msg: "please enter a valid http(s) url." });
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setPrimary(null);
    try {
      const result = await api.analyze(url.trim(), cookieMode);
      setAnalysis(result);
      if (result.metadata.kind === "video") {
        if (mode === "audio") {
          setPrimary({ type: "audio", format: "mp3" });
        } else if (mode === "subs") {
          setPrimary({ type: "subtitles" });
        } else if (result.videoQualities.length > 0) {
          setPrimary({ type: "video", quality: result.videoQualities[0]! });
        }
      } else {
        // Playlists: audio maps to mp3, subtitles pre-selection doesn't apply.
        setPlaylistMode(mode === "audio" ? { kind: "audio", format: "mp3" } : { kind: "best" });
      }
    } catch (err) {
      const e = err as Error & { hint?: string };
      setAnalyzeError({ msg: e.message, hint: e.hint });
    } finally {
      setAnalyzing(false);
    }
  }, [url, cookieMode, mode]);

  const pickMode = useCallback(
    (m: Mode) => {
      setMode(m);
      if (!analysis || isPlaylist) return;
      if (m === "video") {
        if (primary?.type !== "video" && analysis.videoQualities.length > 0) {
          setPrimary({ type: "video", quality: analysis.videoQualities[0]! });
        }
      } else if (m === "audio") {
        if (primary?.type !== "audio") setPrimary({ type: "audio", format: "mp3" });
      } else {
        setPrimary({ type: "subtitles" });
      }
    },
    [analysis, isPlaylist, primary]
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // Clipboard permission can be denied; ignore.
    }
  }, []);

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

  const runningCount = jobs.filter((j) => {
    const st = (snapshots[j.id] ?? j.progress).status ?? j.status;
    return st === "downloading" || st === "processing";
  }).length;

  const toolsBusy = !!system && playlistBlockedBy(system) !== null;
  const cookiesDisabled = !!system && !system.firefox.available;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col items-center px-4 pb-10 pt-3">
      <div className="relative flex w-full items-center justify-end py-1.5">
        <a
          href="#queue"
          aria-label={`download queue, ${runningCount} running`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#2b2b2b] bg-surface text-ink no-underline"
        >
          <ArrowDownIcon className="h-4 w-4" />
          {runningCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-subs px-1 text-[10px] font-bold text-black">
              {runningCount}
            </span>
          )}
        </a>
      </div>

      <div className="flex w-full max-w-[720px] flex-1 flex-col gap-2.5 pt-3">
        {!analysis && <div className="flex-1" />}

        <SystemBanner onReady={() => setAnalyzeError(null)} />

        {resumable.length > 0 && (
          <a
            href="/downloads"
            className="flex items-center gap-2.5 rounded-control bg-surface py-2.5 pl-4 pr-2.5 text-[13px] text-ink no-underline"
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-video" />
            <span className="flex-1">
              {resumable.length} interrupted playlist{resumable.length === 1 ? "" : "s"} can be resumed
            </span>
            <span className="rounded-[8px] bg-raised px-2.5 py-1.5 text-xs">go to library →</span>
          </a>
        )}

        <label htmlFor="url" className="sr-only">
          video or playlist url
        </label>
        <div
          className={cn(
            "flex h-11 items-center gap-2.5 rounded-control border bg-bg pl-3.5 focus-within:border-[#5a5a5a]",
            url ? "border-[#5a5a5a] pr-1.5" : "border-input-border pr-3.5"
          )}
        >
          <SearchIcon className="h-[15px] w-[15px] shrink-0 text-ink-muted" />
          <input
            id="url"
            type="url"
            inputMode="url"
            placeholder="paste the link here"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          {url && (
            <IconButton size={32} aria-label="clear" onClick={() => setUrl("")}>
              <XIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          {isPlaylist ? (
            <span className="px-1 text-xs text-ink-faint">playlist detected — pick a mode below</span>
          ) : (
            <ModeControl mode={mode} onChange={pickMode} />
          )}
          <div className="flex shrink-0 gap-2">
            <Button
              variant={cookieMode ? "primary" : "secondary"}
              disabled={cookiesDisabled}
              onClick={() => setCookieMode((v) => !v)}
            >
              cookies
            </Button>
            <Button variant="secondary" onClick={handlePaste}>
              paste
            </Button>
            <Button loading={analyzing} onClick={handleAnalyze}>
              analyze
            </Button>
          </div>
        </div>
        {!analysis && (
          <p className="px-1 text-xs text-ink-faint">{modeHint(mode)} · press enter to analyze</p>
        )}

        {cookieMode && analysis && (
          <div className="flex items-center gap-2 px-1 text-xs text-ink-faint">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-done" />
            <span>
              cookies from firefox (profile detected) ·{" "}
              <span className="text-ink-muted">--cookies-from-browser firefox</span> · close firefox
              if its cookie file is locked
            </span>
          </div>
        )}

        {analyzeError && (
          <div className="rounded-control bg-danger-bg px-3.5 py-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
              <div>
                <p className="font-medium text-danger-text">{analyzeError.msg}</p>
                {analyzeError.hint && <p className="mt-1 text-xs text-ink-muted">{analyzeError.hint}</p>}
              </div>
            </div>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col gap-3">
            <div className="skeleton h-[99px] w-full" />
            <div className="skeleton h-32 w-full" />
          </div>
        )}

        {analysis && !analyzing && (
          <div className="flex flex-col gap-2.5">
            <MetadataCard
              meta={analysis.metadata}
              subtitleCount={isPlaylist ? undefined : analysis.subtitles.length}
            />

            {isPlaylist ? (
              <>
                <PlaylistPanel
                  count={analysis.metadata.playlistCount}
                  mode={playlistMode}
                  onChange={setPlaylistMode}
                  title={analysis.metadata.title}
                  url={analysis.metadata.webpageUrl}
                  outputDir={outputDirs.playlist}
                />
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!canDownload || toolsBusy}
                  loading={starting}
                  onClick={handleDownload}
                >
                  download {analysis.metadata.playlistCount ?? ""} items
                </Button>
                {toolsBusy && system && (
                  <p className="text-center text-xs text-video">
                    waiting for {playlistBlockedBy(system)} to finish installing
                  </p>
                )}
              </>
            ) : (
              <>
                {mode === "video" && (
                  <VideoOptions
                    qualities={analysis.videoQualities}
                    selectedId={primary?.type === "video" ? primary.quality.id : null}
                    onSelect={(q: VideoQualityOption) => setPrimary({ type: "video", quality: q })}
                  />
                )}
                {mode === "audio" && (
                  <AudioOptions
                    selected={primary?.type === "audio" ? primary.format : null}
                    onSelect={(f: AudioFormat) => setPrimary({ type: "audio", format: f })}
                    estimatedBytes={analysis.audioEstimatedBytes}
                  />
                )}
                {mode === "subs" && (
                  <div className="rounded-card bg-surface p-4 text-[13px] text-ink-muted">
                    only the subtitle tracks you pick below are saved — no video or audio.{" "}
                    <span className="text-ink">--skip-download</span>
                  </div>
                )}

                <SubtitleOptions
                  tracks={analysis.subtitles}
                  config={subConfig}
                  onChange={setSubConfig}
                  embedOk={mode === "video"}
                />

                {primary ? (
                  <ReadyCard
                    primary={primary}
                    subConfig={subConfig}
                    cookieMode={cookieMode}
                    analysis={analysis}
                    outputDir={outputDirs.video}
                    starting={starting}
                    canDownload={canDownload}
                    onDownload={handleDownload}
                  />
                ) : (
                  <p className="rounded-card bg-surface px-4 py-3.5 text-sm text-ink-muted">
                    {mode === "video"
                      ? "no downloadable video formats were found for this url."
                      : "pick a format above to continue."}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <section id="queue" aria-label="queue" className="mt-5 flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-[13px] font-semibold">queue</span>
            {jobs.length > 0 && (
              <span className="text-xs text-ink-faint">
                {runningCount} running · {jobs.filter((j) => ((snapshots[j.id] ?? j.progress).status ?? j.status) === "queued").length} waiting
              </span>
            )}
          </div>
          <DownloadQueue jobs={jobs} snapshots={snapshots} onCancel={handleCancel} />
        </section>

        {!analysis && system && (
          <p className="mt-4 pb-2 text-center text-xs text-ink-faint">
            runs <span className="text-ink">yt-dlp {system.ytdlp.version ?? "?"}</span> +{" "}
            <span className="text-ink">ffmpeg {system.ffmpeg.version ?? "?"}</span> on this machine
            {system.firefox.available ? " · firefox detected for cookies" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function modeHint(mode: Mode): string {
  if (mode === "audio") return "opens on audio formats after analysis (playlists: mp3)";
  if (mode === "subs") return "opens on subtitles only after analysis (single videos)";
  return "opens on video quality after analysis";
}

/** Which tool (if any) a playlist download is currently blocked on. */
function playlistBlockedBy(system: NonNullable<ReturnType<typeof useTools>["system"]>): string | null {
  if (!system.ytdlp.available) return "yt-dlp";
  if (!system.ffmpeg.available) return "ffmpeg";
  return null;
}

function ModeControl({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const items: { id: Mode; label: string }[] = [
    { id: "video", label: "video" },
    { id: "audio", label: "audio" },
    { id: "subs", label: "subtitles" },
  ];
  return (
    <div role="group" aria-label="download mode" className="flex overflow-hidden rounded-control bg-surface-2">
      {items.map((it, i) => {
        const on = it.id === mode;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.id)}
            className={cn(
              "flex h-[38px] cursor-pointer items-center px-3.5 text-sm font-medium transition-colors duration-150",
              i < items.length - 1 && "border-r border-black",
              on ? "bg-ink text-black" : "bg-transparent text-ink hover:bg-[#1a1a1a]"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

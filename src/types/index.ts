// =====================================================================
// Shared domain types for yt-dlp Studio.
// These types form the contract between the yt-dlp service layer,
// the API routes, and the React frontend.
// =====================================================================

/** Whether an analyzed URL resolves to a single video or a playlist. */
export type MediaKind = "video" | "playlist";

/** Discrete quality buckets surfaced in the UI. */
export type QualityLabel = "4K" | "2K" | "1080p" | "720p" | "480p" | "360p" | "144p";

/** Audio container the user can extract to (handled by ffmpeg). */
export type AudioFormat = "mp3" | "wav" | "aac";

/** What kind of job the queue is processing. */
export type DownloadType = "video" | "audio" | "subtitles" | "playlist";

/** Lifecycle status of a queued/finished job. */
export type JobStatus =
  | "queued"
  | "downloading"
  | "processing" // post-processing (ffmpeg merge / extract)
  | "completed"
  | "failed"
  | "interrupted"
  | "canceled";

// ---------------------------------------------------------------------
// Analysis result
// ---------------------------------------------------------------------

/** A single selectable video quality, derived from yt-dlp formats. */
export interface VideoQualityOption {
  /** Stable, unique key combining resolution + container (e.g. "1080p-webm"). */
  id: string;
  label: QualityLabel;
  height: number;
  /** Output file format the download will produce (e.g. "mp4", "webm"). */
  container: string;
  /** Value passed to yt-dlp's --merge-output-format (matches `container`). */
  mergeFormat: string;
  /** yt-dlp -f selector used to fetch this quality. */
  formatSelector: string;
  /** Estimated total size in bytes (video + best audio), if known. */
  estimatedBytes: number | null;
  fps?: number | null;
  vcodec?: string | null;
}

/** An available subtitle track. */
export interface SubtitleTrack {
  langCode: string;
  langName: string;
  /** True when this track is auto-generated rather than human authored. */
  auto: boolean;
}

/** Metadata shown after analysis. */
export interface MediaMetadata {
  id: string;
  kind: MediaKind;
  title: string;
  uploader: string | null;
  thumbnail: string | null;
  durationSeconds: number | null;
  uploadDate: string | null; // ISO yyyy-mm-dd when available
  viewCount: number | null;
  webpageUrl: string;
  /** Number of entries when kind === "playlist". */
  playlistCount?: number;
}

/** Full result returned by /api/analyze. */
export interface AnalysisResult {
  metadata: MediaMetadata;
  videoQualities: VideoQualityOption[];
  audioAvailable: boolean;
  /** Rough estimated bytes for a best-audio-only download. */
  audioEstimatedBytes: number | null;
  subtitles: SubtitleTrack[];
}

// ---------------------------------------------------------------------
// Download requests
// ---------------------------------------------------------------------

export interface SubtitleRequest {
  /** Selected subtitle language codes. Empty = none. */
  langs: string[];
  /** Include auto-generated captions. */
  includeAuto: boolean;
  /** Convert the downloaded subs to .srt. */
  convertToSrt: boolean;
  /** Download subtitles only (no media). */
  subtitlesOnly: boolean;
  /** Embed subtitles into the video container. */
  embed: boolean;
}

export interface DownloadRequest {
  url: string;
  kind: MediaKind;
  type: DownloadType;
  title?: string;
  /** For type === "video": the chosen format selector. */
  formatSelector?: string;
  /** For type === "video": output container for --merge-output-format. */
  mergeFormat?: string;
  /** Human label of the chosen quality (for history display). */
  qualityLabel?: string;
  /** For type === "audio": target audio container. */
  audioFormat?: AudioFormat;
  /** Subtitle configuration (optional). */
  subtitles?: SubtitleRequest;
  /** Use Firefox cookies for authenticated downloads. */
  cookieMode?: boolean;
  /** Override output directory; falls back to settings. */
  outputDir?: string;
}

// ---------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------

/** A point-in-time progress snapshot streamed over SSE. */
export interface ProgressSnapshot {
  jobId: string;
  status: JobStatus;
  /** 0–100, overall job percent (for playlists this blends item + index). */
  percent: number;
  /** Current file/item being processed. */
  currentFile: string | null;
  /** Bytes/sec as reported by yt-dlp, formatted string e.g. "1.2MiB/s". */
  speed: string | null;
  /** ETA string from yt-dlp e.g. "00:42". */
  eta: string | null;
  /** Playlist progress, when applicable. */
  playlistIndex?: number;
  playlistTotal?: number;
  /** Most recent human-readable log line. */
  message?: string;
  /** Populated when status === "failed". */
  error?: string;
}

// ---------------------------------------------------------------------
// Queue jobs
// ---------------------------------------------------------------------

export interface QueueJob {
  id: string;
  request: DownloadRequest;
  status: JobStatus;
  progress: ProgressSnapshot;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  outputDir: string;
  error?: string;
  /** Exact yt-dlp command line that was spawned (for the "copy command" UI). */
  command?: string;
}

// ---------------------------------------------------------------------
// History & playlist state (persisted to disk)
// ---------------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  date: number; // epoch ms
  outputLocation: string;
  type: DownloadType;
  status: Extract<JobStatus, "completed" | "failed" | "interrupted">;
  // Playlist-specific fields:
  playlistTotal?: number;
  playlistCompleted?: number;
  /** Path to the yt-dlp --download-archive file for resuming. */
  archivePath?: string;
  /** The full download request, kept so failed downloads can be retried. */
  request?: DownloadRequest;
}

export interface PlaylistState {
  id: string; // playlist id (or hash of url)
  title: string;
  url: string;
  total: number;
  completed: number;
  archivePath: string;
  outputDir: string;
  request: DownloadRequest;
  status: Extract<JobStatus, "downloading" | "interrupted" | "completed">;
  updatedAt: number;
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

export interface AppSettings {
  videoOutputDir: string;
  playlistOutputDir: string;
  /** Default to enabling Firefox cookie mode. */
  cookieModeDefault: boolean;
  /** Limit concurrent downloads. */
  maxConcurrent: number;
}

// ---------------------------------------------------------------------
// System / environment checks
// ---------------------------------------------------------------------

/** Where a tool binary was found. */
export type ToolSource = "local" | "path" | "none";

export interface SystemStatus {
  ytdlp: { available: boolean; version?: string; path?: string; source: ToolSource };
  ffmpeg: { available: boolean; version?: string; path?: string; source: ToolSource };
  firefox: { available: boolean; profilesFound: boolean };
  /** Folder the app looks in / installs tools into (next to the portable exe). */
  binDir: string;
  /** True on platforms where the in-app installer can fetch binaries (win32). */
  canInstall: boolean;
}

/** Which downloadable tool an install request targets. */
export type ToolName = "ytdlp" | "ffmpeg";

export type ToolInstallState =
  | "idle"
  | "downloading"
  | "extracting"
  | "done"
  | "error";

/** Live state of an in-app tool installation (polled by the UI). */
export interface ToolInstallStatus {
  tool: ToolName;
  state: ToolInstallState;
  percent: number;
  message?: string;
  /** Resolved install path once complete. */
  path?: string;
}

// ---------------------------------------------------------------------
// API envelope
// ---------------------------------------------------------------------

export interface ApiError {
  error: string;
  code?: string;
  /** Optional remediation hint shown to the user. */
  hint?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

import type { QualityLabel, SubtitleTrack, VideoQualityOption } from "@/types";

/** Raw yt-dlp format object (subset of fields we consume). */
export interface RawFormat {
  format_id: string;
  ext?: string;
  vcodec?: string;
  acodec?: string;
  height?: number | null;
  width?: number | null;
  fps?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  tbr?: number | null;
  abr?: number | null;
  format_note?: string;
}

const BUCKETS: { label: QualityLabel; min: number; selectorHeight: number }[] = [
  { label: "4K", min: 2160, selectorHeight: 2160 },
  { label: "2K", min: 1440, selectorHeight: 1440 },
  { label: "1080p", min: 1080, selectorHeight: 1080 },
  { label: "720p", min: 720, selectorHeight: 720 },
  { label: "480p", min: 480, selectorHeight: 480 },
  { label: "360p", min: 360, selectorHeight: 360 },
  { label: "144p", min: 0, selectorHeight: 240 },
];

function bucketForHeight(height: number): (typeof BUCKETS)[number] {
  for (const b of BUCKETS) {
    if (height >= b.min) return b;
  }
  return BUCKETS[BUCKETS.length - 1]!;
}

function sizeOf(f: RawFormat): number | null {
  return f.filesize ?? f.filesize_approx ?? null;
}

function isVideo(f: RawFormat): boolean {
  return !!f.vcodec && f.vcodec !== "none" && !!f.height;
}

function isAudioOnly(f: RawFormat): boolean {
  return (!f.vcodec || f.vcodec === "none") && !!f.acodec && f.acodec !== "none";
}

/** Best audio-only stream size, used to estimate combined download size. */
export function bestAudioBytes(formats: RawFormat[]): number | null {
  const audio = formats.filter(isAudioOnly);
  if (!audio.length) return null;
  const best = audio.reduce((a, b) => {
    const ab = a.abr ?? a.tbr ?? 0;
    const bb = b.abr ?? b.tbr ?? 0;
    return bb > ab ? b : a;
  });
  return sizeOf(best);
}

/** Container display order, so rows are stable and readable. */
const CONTAINER_ORDER = ["mp4", "webm", "mkv"];

/** Audio extension that merges cleanly into a given video container. */
function audioExtFor(container: string): string | null {
  if (container === "mp4") return "m4a";
  if (container === "webm") return "webm";
  return null;
}

/**
 * Reduce raw yt-dlp formats to the discrete, selectable options the UI exposes.
 * One option is emitted per (resolution bucket, container) that actually exists
 * for this video — so e.g. both "1080p MP4" and "1080p WEBM" can appear. The
 * chosen stream is pinned by format id so the downloaded file matches the format
 * shown (no generic auto-selection), and is merged into that same container.
 * Ordered highest → lowest resolution, then by container preference.
 */
export function parseVideoQualities(formats: RawFormat[]): VideoQualityOption[] {
  const audioBytes = bestAudioBytes(formats);
  // key = `${bucket.label}|${ext}` → best stream for that resolution+container.
  const byKey = new Map<
    string,
    { fmt: RawFormat; bucket: (typeof BUCKETS)[number]; ext: string }
  >();

  for (const f of formats) {
    if (!isVideo(f) || !f.height) continue;
    const bucket = bucketForHeight(f.height);
    const ext = (f.ext ?? "mp4").toLowerCase();
    const key = `${bucket.label}|${ext}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { fmt: f, bucket, ext });
      continue;
    }
    // Prefer the higher-bitrate (better) stream within the same group.
    const cur = existing.fmt.tbr ?? sizeOf(existing.fmt) ?? 0;
    const next = f.tbr ?? sizeOf(f) ?? 0;
    if (next > cur) byKey.set(key, { fmt: f, bucket, ext });
  }

  const containerRank = (ext: string) => {
    const i = CONTAINER_ORDER.indexOf(ext);
    return i === -1 ? CONTAINER_ORDER.length : i;
  };

  const entries = [...byKey.values()].sort((a, b) => {
    // Highest resolution first (smaller bucket index = higher res).
    const ra = BUCKETS.indexOf(a.bucket);
    const rb = BUCKETS.indexOf(b.bucket);
    if (ra !== rb) return ra - rb;
    return containerRank(a.ext) - containerRank(b.ext);
  });

  const options: VideoQualityOption[] = [];
  for (const { fmt, bucket, ext } of entries) {
    const { label, selectorHeight } = bucket;
    const videoBytes = sizeOf(fmt);
    const estimatedBytes =
      videoBytes !== null ? videoBytes + (audioBytes ?? 0) : null;
    const aext = audioExtFor(ext);
    const audioSel = aext ? `bestaudio[ext=${aext}]/bestaudio` : "bestaudio";
    options.push({
      id: `${label}-${ext}`,
      label,
      height: fmt.height ?? selectorHeight,
      container: ext,
      mergeFormat: ext,
      // Pin the exact video stream the user picked (so the saved format matches
      // what's shown), merge a compatible audio track, with safe fallbacks.
      formatSelector: `${fmt.format_id}+${audioSel}/${fmt.format_id}/best[height<=${selectorHeight}]`,
      estimatedBytes,
      fps: fmt.fps ?? null,
      vcodec: fmt.vcodec ?? null,
    });
  }
  return options;
}

/** Build the subtitle track list from yt-dlp's subtitles + automatic_captions. */
export function parseSubtitles(
  subtitles: Record<string, unknown> | undefined,
  autoCaptions: Record<string, unknown> | undefined
): SubtitleTrack[] {
  const tracks: SubtitleTrack[] = [];
  const seen = new Set<string>();

  const add = (langCode: string, auto: boolean) => {
    const key = `${langCode}:${auto}`;
    if (seen.has(key)) return;
    seen.add(key);
    tracks.push({ langCode, langName: languageName(langCode), auto });
  };

  if (subtitles) Object.keys(subtitles).forEach((code) => add(code, false));
  if (autoCaptions) Object.keys(autoCaptions).forEach((code) => add(code, true));

  // Human subs first, then alphabetical.
  return tracks.sort((a, b) => {
    if (a.auto !== b.auto) return a.auto ? 1 : -1;
    return a.langCode.localeCompare(b.langCode);
  });
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  id: "Indonesian",
  th: "Thai",
};

function languageName(code: string): string {
  const base = code.split("-")[0]!.toLowerCase();
  const name = LANG_NAMES[base];
  return name ? (code.includes("-") ? `${name} (${code})` : name) : code;
}

import { runCollect, ytDlpBinary } from "./exec";
import { bestAudioBytes, parseSubtitles, parseVideoQualities, type RawFormat } from "./formats";
import { formatUploadDate } from "@/lib/utils/format-bytes";
import { YtDlpError, classifyYtDlpError } from "./errors";
import type { AnalysisResult, MediaMetadata } from "@/types";

interface RawInfo {
  _type?: string;
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  thumbnail?: string;
  thumbnails?: { url: string }[];
  duration?: number;
  upload_date?: string;
  view_count?: number;
  webpage_url?: string;
  original_url?: string;
  formats?: RawFormat[];
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
  entries?: (RawInfo | null)[];
  playlist_count?: number;
}

/**
 * Analyze a URL with a single yt-dlp call.
 * `--flat-playlist` keeps playlist analysis fast (it does not extract every
 * entry) while still returning full format info for a single video.
 */
export async function analyzeUrl(url: string, cookieMode = false): Promise<AnalysisResult> {
  const args = [
    "-J",
    "--flat-playlist",
    "--no-warnings",
    "--no-progress",
    ...(cookieMode ? ["--cookies-from-browser", "firefox"] : []),
    url,
  ];

  let result;
  try {
    result = await runCollect(ytDlpBinary(), args, { timeoutMs: 60_000 });
  } catch (err) {
    throw classifyYtDlpError(err, "");
  }

  if (result.code !== 0) {
    throw classifyYtDlpError(null, result.stderr || result.stdout);
  }

  let info: RawInfo;
  try {
    info = JSON.parse(result.stdout) as RawInfo;
  } catch {
    throw new YtDlpError("Could not parse yt-dlp output.", "PARSE_ERROR");
  }

  const isPlaylist = info._type === "playlist" || Array.isArray(info.entries);

  const metadata: MediaMetadata = {
    id: info.id ?? "",
    kind: isPlaylist ? "playlist" : "video",
    title: info.title ?? "Untitled",
    uploader: info.uploader ?? info.channel ?? null,
    thumbnail: pickThumbnail(info),
    durationSeconds: info.duration ?? null,
    uploadDate: formatUploadDate(info.upload_date),
    viewCount: info.view_count ?? null,
    webpageUrl: info.webpage_url ?? info.original_url ?? url,
  };

  if (isPlaylist) {
    const entries = (info.entries ?? []).filter(Boolean) as RawInfo[];
    metadata.playlistCount = info.playlist_count ?? entries.length;
    // Borrow a thumbnail from the first entry if the playlist lacks one.
    if (!metadata.thumbnail && entries[0]) {
      metadata.thumbnail = pickThumbnail(entries[0]);
    }
    return {
      metadata,
      videoQualities: [],
      audioAvailable: true,
      audioEstimatedBytes: null,
      subtitles: [],
    };
  }

  const formats = info.formats ?? [];
  return {
    metadata,
    videoQualities: parseVideoQualities(formats),
    audioAvailable: formats.some((f) => f.acodec && f.acodec !== "none"),
    audioEstimatedBytes: bestAudioBytes(formats),
    subtitles: parseSubtitles(info.subtitles, info.automatic_captions),
  };
}

function pickThumbnail(info: RawInfo): string | null {
  if (info.thumbnail) return info.thumbnail;
  if (info.thumbnails?.length) {
    return info.thumbnails[info.thumbnails.length - 1]!.url;
  }
  return null;
}

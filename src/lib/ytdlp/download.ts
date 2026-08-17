import { PROGRESS_TEMPLATE } from "./progress";
import type { DownloadRequest } from "@/types";

export interface BuildContext {
  /** Fully-resolved -o output template (includes directory + filename pattern). */
  outputTemplate: string;
  /** Path to the --download-archive file (playlists / resumable jobs). */
  archivePath?: string;
}

/**
 * Translate a DownloadRequest into a concrete yt-dlp argv.
 * The logic mirrors the option groups in the UI (video / audio / subtitles
 * / playlist) and the cookie-mode toggle.
 */
export function buildDownloadArgs(req: DownloadRequest, ctx: BuildContext): string[] {
  const args: string[] = [
    "--newline",
    "--no-warnings",
    "--progress-template",
    PROGRESS_TEMPLATE,
    "-o",
    ctx.outputTemplate,
  ];

  // Cookie mode: authenticate via the user's Firefox profile.
  if (req.cookieMode) {
    args.push("--cookies-from-browser", "firefox");
  }

  // Playlists: keep going past individual failures and record successes so
  // the download can be resumed without re-fetching completed items.
  if (req.kind === "playlist") {
    args.push("--yes-playlist", "--ignore-errors");
    if (ctx.archivePath) args.push("--download-archive", ctx.archivePath);
  } else {
    args.push("--no-playlist");
  }

  // ---- Content selection by job type ----
  if (req.type === "audio") {
    const fmt = req.audioFormat ?? "mp3";
    args.push("-x", "--audio-format", fmt, "--audio-quality", "0");
  } else if (req.type === "subtitles") {
    // Subtitles only — no media stream.
    args.push("--skip-download");
    applySubtitleArgs(args, req, /* forceWrite */ true);
  } else {
    // Video (single best-quality or per-playlist best).
    const selector =
      req.formatSelector ?? (req.kind === "playlist" ? "bv*+ba/b" : "bestvideo+bestaudio/best");
    args.push("-f", selector, "--merge-output-format", req.mergeFormat ?? "mp4");
    // Subtitles alongside the video, if requested.
    applySubtitleArgs(args, req, /* forceWrite */ false);
  }

  args.push(req.url);
  return args;
}

function applySubtitleArgs(args: string[], req: DownloadRequest, forceWrite: boolean) {
  const subs = req.subtitles;
  if (!subs) return;
  const wantsSubs =
    forceWrite || subs.subtitlesOnly || subs.embed || subs.langs.length > 0;
  if (!wantsSubs) return;

  if (subs.langs.length > 0) {
    args.push("--sub-langs", subs.langs.join(","));
  } else {
    args.push("--sub-langs", "all");
  }

  args.push("--write-subs");
  if (subs.includeAuto) args.push("--write-auto-subs");
  if (subs.convertToSrt) args.push("--convert-subs", "srt");
  // Embedding only makes sense when a media file is being produced.
  if (subs.embed && req.type !== "subtitles") args.push("--embed-subs");
}

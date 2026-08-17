import path from "node:path";
import type { ProgressSnapshot } from "@/types";

/**
 * Machine-readable progress template passed to yt-dlp. Each in-progress
 * update is emitted on its own line (with --newline) prefixed by a sentinel
 * so we can distinguish it from ordinary log output.
 */
export const PROGRESS_SENTINEL = "__YTP__";
export const PROGRESS_TEMPLATE =
  `${PROGRESS_SENTINEL}\t%(progress.status)s\t%(progress._percent_str)s` +
  `\t%(progress._speed_str)s\t%(progress._eta_str)s\t%(progress.filename)s`;

const playlistRe = /Downloading (?:item|video) (\d+) of (\d+)/i;
const ppRe =
  /^\[(ExtractAudio|Merger|VideoConvertor|EmbedSubtitle|FixupM4a|FixupM3u8|Metadata|VideoRemuxer)\]/i;

function cleanPercent(raw: string): number | null {
  const m = /(-?\d+(?:\.\d+)?)\s*%/.exec(raw);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

function nullable(value: string): string | null {
  const v = value?.trim();
  return !v || v === "NA" || v === "N/A" ? null : v;
}

/**
 * Parse one output line into a partial progress update.
 * Returns null for lines that carry no progress signal.
 */
export function parseProgressLine(line: string): Partial<ProgressSnapshot> | null {
  if (line.startsWith(PROGRESS_SENTINEL)) {
    const [, status, percent, speed, eta, filename] = line.split("\t");
    const update: Partial<ProgressSnapshot> = {};
    const pct = cleanPercent(percent ?? "");
    if (pct !== null) update.percent = pct;
    update.speed = nullable(speed ?? "");
    update.eta = nullable(eta ?? "");
    const file = nullable(filename ?? "");
    if (file) update.currentFile = path.basename(file);
    if (status === "finished") {
      update.status = "processing";
      update.percent = 100;
    } else if (status === "downloading") {
      update.status = "downloading";
    }
    return update;
  }

  const pl = playlistRe.exec(line);
  if (pl) {
    return {
      playlistIndex: Number.parseInt(pl[1]!, 10),
      playlistTotal: Number.parseInt(pl[2]!, 10),
      message: line.trim(),
    };
  }

  if (ppRe.test(line)) {
    return { status: "processing", message: line.trim() };
  }

  return null;
}

/**
 * Blend playlist item progress with per-file percent so the overall bar
 * advances smoothly across a multi-item playlist.
 */
export function overallPercent(snap: ProgressSnapshot): number {
  if (snap.playlistTotal && snap.playlistTotal > 0 && snap.playlistIndex) {
    const base = ((snap.playlistIndex - 1) / snap.playlistTotal) * 100;
    const within = (snap.percent / snap.playlistTotal);
    return Math.min(100, Math.round(base + within));
  }
  return Math.round(snap.percent);
}

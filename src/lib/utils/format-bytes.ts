/** Human-readable byte formatting (binary units, matching yt-dlp style). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

/** Format a duration in seconds to H:MM:SS or M:SS. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Compact view-count formatting: 1.2M, 14.3K, 932. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Convert yt-dlp's upload_date (YYYYMMDD) into ISO YYYY-MM-DD. */
export function formatUploadDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

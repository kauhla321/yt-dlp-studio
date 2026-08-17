/** Error codes surfaced to the UI for tailored messaging. */
export type YtDlpErrorCode =
  | "YTDLP_MISSING"
  | "FFMPEG_MISSING"
  | "INVALID_URL"
  | "PRIVATE_VIDEO"
  | "AGE_RESTRICTED"
  | "UNAVAILABLE"
  | "NO_FORMATS"
  | "COOKIE_FAILURE"
  | "GEO_BLOCKED"
  | "NETWORK"
  | "PARSE_ERROR"
  | "UNKNOWN";

export class YtDlpError extends Error {
  code: YtDlpErrorCode;
  hint?: string;
  constructor(message: string, code: YtDlpErrorCode, hint?: string) {
    super(message);
    this.name = "YtDlpError";
    this.code = code;
    this.hint = hint;
  }
}

interface Matcher {
  test: RegExp;
  code: YtDlpErrorCode;
  message: string;
  hint?: string;
}

const MATCHERS: Matcher[] = [
  {
    test: /private video|this video is private/i,
    code: "PRIVATE_VIDEO",
    message: "This video is private and cannot be downloaded.",
    hint: "If you have access, enable Cookie Mode to authenticate with your Firefox login.",
  },
  {
    test: /sign in to confirm your age|age[- ]restricted|inappropriate for some users/i,
    code: "AGE_RESTRICTED",
    message: "This video is age-restricted.",
    hint: "Enable Cookie Mode so yt-dlp can use your signed-in Firefox session.",
  },
  {
    test: /video unavailable|has been removed|account.*terminated|no longer available/i,
    code: "UNAVAILABLE",
    message: "This video is unavailable or has been removed.",
  },
  {
    test: /requested format (is )?not available|no video formats found|no formats/i,
    code: "NO_FORMATS",
    message: "No downloadable formats were found for this URL.",
  },
  {
    test: /could not (find|copy) (the )?(firefox )?cookies|unable to (open|read).*cookie|no such file.*cookies|could not find firefox/i,
    code: "COOKIE_FAILURE",
    message: "Could not read cookies from Firefox.",
    hint: "Make sure Firefox is installed, you've signed in at least once, and Firefox is fully closed while downloading.",
  },
  {
    test: /not available in your (country|location)|geo[- ]?restricted|blocked it in your country/i,
    code: "GEO_BLOCKED",
    message: "This content is geo-restricted in your region.",
  },
  {
    test: /ffmpeg.*not.*(found|installed)|ffprobe.*not.*found|you have requested merging.*ffmpeg/i,
    code: "FFMPEG_MISSING",
    message: "ffmpeg is required for this operation but was not found.",
    hint: "Install ffmpeg and make sure it is on your PATH (or set FFMPEG_PATH).",
  },
  {
    test: /is not a valid url|unsupported url|unable to extract|is not a valid integer/i,
    code: "INVALID_URL",
    message: "That URL is not supported or could not be understood.",
    hint: "Check the link and try again.",
  },
  {
    test: /unable to (download|connect)|connection (reset|refused|timed out)|temporary failure in name resolution|getaddrinfo/i,
    code: "NETWORK",
    message: "A network error occurred while contacting the server.",
    hint: "Check your internet connection and retry.",
  },
];

/**
 * Convert a spawn error or yt-dlp stderr into a typed, user-friendly error.
 */
export function classifyYtDlpError(spawnErr: unknown, stderr: string): YtDlpError {
  const e = spawnErr as NodeJS.ErrnoException | null;
  if (e?.code === "ENOENT") {
    return new YtDlpError(
      "yt-dlp was not found on this system.",
      "YTDLP_MISSING",
      "Install yt-dlp and ensure it is on your PATH, or set the YT_DLP_PATH environment variable."
    );
  }

  const text = stderr || (spawnErr instanceof Error ? spawnErr.message : "");
  for (const m of MATCHERS) {
    if (m.test.test(text)) return new YtDlpError(m.message, m.code, m.hint);
  }

  // Fall back to the last meaningful ERROR line from yt-dlp, trimmed.
  const errorLine = text
    .split(/\r?\n/)
    .reverse()
    .find((l) => /error/i.test(l));
  return new YtDlpError(
    errorLine?.replace(/^ERROR:\s*/i, "").trim() || "yt-dlp failed for an unknown reason.",
    "UNKNOWN"
  );
}

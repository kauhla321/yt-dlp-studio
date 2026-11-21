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
  | "COOKIES_REJECTED"
  | "AGE_VERIFICATION"
  | "BOT_CHECK"
  | "JS_RUNTIME_MISSING"
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

const BOT_CHECK_RE = /sign in to confirm you(’|'|`)?re not a bot/i;

interface Matcher {
  test: RegExp;
  code: YtDlpErrorCode;
  message: string;
  hint?: string;
}

const MATCHERS: Matcher[] = [
  {
    // Must run before the age/private matchers: it's also a "sign in" error.
    test: BOT_CHECK_RE,
    code: "BOT_CHECK",
    message: "YouTube is asking to confirm you're not a bot.",
    hint: "Turn on Cookie Mode while signed in to youtube.com in Firefox, then retry.",
  },
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
    test: /could not (find|copy) (the )?(firefox )?cookies|unable to (open|read).*cookie|no such file.*cookies|could not find firefox|failed to (decrypt|load) cookies|database is locked/i,
    code: "COOKIE_FAILURE",
    message: "Could not read cookies from Firefox.",
    hint: "Make sure Firefox is installed and you've opened it at least once. If it still fails, fully close Firefox and retry.",
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

/** Context about how yt-dlp was invoked, used to tailor the advice. */
export interface ClassifyContext {
  /** Whether --cookies-from-browser firefox was passed. */
  cookieMode?: boolean;
}

// yt-dlp warnings that explain *why* an error happened. They are only visible
// because we no longer pass --no-warnings; the final ERROR line alone is often
// identical with and without cookies ("Sign in to confirm your age").
const COOKIES_ROTATED = /cookies are no longer valid|cookies have (likely )?been rotated/i;
const AGE_VERIFICATION_REQUIRED = /requiring account age[- ]verification/i;
// A challenge that actually failed (formats were dropped because of it)...
const JS_CHALLENGE_FAILED = /(n challenge|signature) solving failed|only images are available/i;
// ...versus yt-dlp merely noting that no runtime is installed. That note is
// printed on every anonymous YouTube request without deno, even ones that
// fail for unrelated reasons (e.g. age-restriction with cookies off), so on
// its own it only explains a "no formats" failure.
const NO_JS_RUNTIME = /no supported javascript runtime/i;

/**
 * Convert a spawn error or yt-dlp stderr into a typed, user-friendly error.
 * `stderr` may include WARNING lines; the ERROR line(s) decide the category
 * and the warnings refine it (e.g. "cookies were used but rejected").
 */
export function classifyYtDlpError(
  spawnErr: unknown,
  stderr: string,
  ctx: ClassifyContext = {}
): YtDlpError {
  const e = spawnErr as NodeJS.ErrnoException | null;
  if (e?.code === "ENOENT") {
    return new YtDlpError(
      "yt-dlp was not found on this system.",
      "YTDLP_MISSING",
      "Install yt-dlp and ensure it is on your PATH, or set the YT_DLP_PATH environment variable."
    );
  }

  const text = stderr || (spawnErr instanceof Error ? spawnErr.message : "");
  const lines = text.split(/\r?\n/);
  const errorText = lines.filter((l) => /^\s*ERROR:/i.test(l)).join("\n");
  const warningText = lines.filter((l) => /^\s*WARNING:/i.test(l)).join("\n");

  // Match on ERROR lines first so a warning like "This video is age-restricted;
  // some formats may be missing" can't mask the real failure.
  const base =
    (errorText && MATCHERS.find((m) => m.test.test(errorText))) ||
    MATCHERS.find((m) => m.test.test(text)) ||
    null;

  const refined = refine(base?.code ?? "UNKNOWN", warningText, ctx);
  if (refined) return refined;
  if (base) return new YtDlpError(base.message, base.code, base.hint);

  // Fall back to the last meaningful ERROR line from yt-dlp, trimmed.
  const errorLine = [...lines].reverse().find((l) => /^\s*ERROR:/i.test(l)) ??
    [...lines].reverse().find((l) => /error/i.test(l) && !/^\s*WARNING:/i.test(l));
  return new YtDlpError(
    errorLine?.replace(/^\s*ERROR:\s*/i, "").trim() || "yt-dlp failed for an unknown reason.",
    "UNKNOWN"
  );
}

/**
 * Turn a generic category into the actual cause when the warnings (or the
 * cookie-mode flag) tell us more. Returns null to keep the base result.
 */
function refine(
  code: YtDlpErrorCode,
  warnings: string,
  ctx: ClassifyContext
): YtDlpError | null {
  // Hard failures to read the cookie store win over everything else.
  if (code === "COOKIE_FAILURE") return null;

  const authProblem =
    code === "AGE_RESTRICTED" || code === "PRIVATE_VIDEO" || code === "BOT_CHECK";

  if (COOKIES_ROTATED.test(warnings) && (authProblem || code === "NO_FORMATS" || code === "UNKNOWN")) {
    return new YtDlpError(
      "Firefox's YouTube cookies were read, but YouTube no longer accepts them (they were rotated or you were signed out).",
      "COOKIES_REJECTED",
      "Open youtube.com in Firefox and make sure you're signed in, play any video, then fully close Firefox and retry."
    );
  }

  if (AGE_VERIFICATION_REQUIRED.test(warnings) && (authProblem || code === "NO_FORMATS" || code === "UNKNOWN")) {
    return new YtDlpError(
      "You're signed in, but YouTube requires this account to be age-verified to watch this video.",
      "AGE_VERIFICATION",
      "Verify your age on youtube.com with the account signed in to Firefox (or sign in with an account that is already verified), then retry."
    );
  }

  const jsCause =
    (JS_CHALLENGE_FAILED.test(warnings) &&
      (code === "NO_FORMATS" || code === "UNKNOWN" || (authProblem && ctx.cookieMode))) ||
    (NO_JS_RUNTIME.test(warnings) && code === "NO_FORMATS");
  if (jsCause) {
    return new YtDlpError(
      "YouTube needs a JavaScript runtime (deno) to unlock the formats for this video.",
      "JS_RUNTIME_MISSING",
      ctx.cookieMode
        ? "Signed-in (cookie) downloads always need one. Install deno from Settings → tools, then retry."
        : "Install deno from Settings → tools, then retry."
    );
  }

  // Same ERROR with and without cookies — tell the user cookies were tried.
  if (ctx.cookieMode && code === "AGE_RESTRICTED") {
    return new YtDlpError(
      "This video is age-restricted, and the Firefox session didn't unlock it.",
      "AGE_RESTRICTED",
      "Cookie mode is already on. Sign in to youtube.com in Firefox with an adult (age-verified) account, play the video once there, then fully close Firefox and retry."
    );
  }
  if (ctx.cookieMode && code === "PRIVATE_VIDEO") {
    return new YtDlpError(
      "This video is private, and the Firefox session doesn't have access to it.",
      "PRIVATE_VIDEO",
      "Cookie mode is already on. Sign in to youtube.com in Firefox with an account that can watch this video, then retry."
    );
  }
  if (ctx.cookieMode && code === "BOT_CHECK") {
    return new YtDlpError(
      "YouTube is asking to confirm you're not a bot, and the Firefox session didn't satisfy it.",
      "BOT_CHECK",
      "Sign in to youtube.com in Firefox, play a video there, then fully close Firefox and retry."
    );
  }

  return null;
}

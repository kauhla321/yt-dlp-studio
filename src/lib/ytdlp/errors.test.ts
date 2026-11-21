import { describe, expect, it } from "vitest";
import { classifyYtDlpError, YtDlpError } from "./errors";

describe("classifyYtDlpError", () => {
  it("maps ENOENT to YTDLP_MISSING with an install hint", () => {
    const err = classifyYtDlpError({ code: "ENOENT" }, "");
    expect(err).toBeInstanceOf(YtDlpError);
    expect(err.code).toBe("YTDLP_MISSING");
    expect(err.message).toContain("yt-dlp was not found");
    expect(err.hint).toBeTruthy();
  });

  const cases: Array<[string, string, string]> = [
    ["this video is private", "ERROR: This video is private.", "PRIVATE_VIDEO"],
    ["sign in to confirm your age", "ERROR: Sign in to confirm your age", "AGE_RESTRICTED"],
    ["video unavailable", "ERROR: Video unavailable", "UNAVAILABLE"],
    ["no formats", "ERROR: Requested format is not available", "NO_FORMATS"],
    ["cookie failure", "ERROR: Could not find the firefox cookies", "COOKIE_FAILURE"],
    ["geo blocked", "ERROR: This video is not available in your country", "GEO_BLOCKED"],
    ["ffmpeg missing", "ERROR: ffmpeg was not found", "FFMPEG_MISSING"],
    ["invalid url", "ERROR: yt-dlp: error: is not a valid URL", "INVALID_URL"],
    ["network", "ERROR: Unable to download webpage: connection timed out", "NETWORK"],
  ];

  it.each(cases)("classifies %s as %s", (_label, stderr, code) => {
    const err = classifyYtDlpError(null, stderr);
    expect(err.code).toBe(code);
  });

  it("falls back to the last ERROR line", () => {
    const err = classifyYtDlpError(null, "[debug] stuff\nERROR: something went bad");
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("something went bad");
  });

  it("falls back to a generic message when nothing matches", () => {
    const err = classifyYtDlpError(null, "gibberish output");
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("yt-dlp failed for an unknown reason.");
  });

  describe("cookie mode", () => {
    // Real yt-dlp 2026.10 output for an age-restricted video (cookies off).
    const AGE_ERR =
      "ERROR: [youtube] 4UoC0ppf4Lo: Sign in to confirm your age. This video may be inappropriate for some users. Use --cookies-from-browser or --cookies for the authentication.";

    it("tells the user to enable cookie mode when it is off", () => {
      const err = classifyYtDlpError(null, AGE_ERR, { cookieMode: false });
      expect(err.code).toBe("AGE_RESTRICTED");
      expect(err.hint).toMatch(/enable cookie mode/i);
    });

    it("does not tell the user to enable cookie mode when it is already on", () => {
      const err = classifyYtDlpError(null, AGE_ERR, { cookieMode: true });
      expect(err.code).toBe("AGE_RESTRICTED");
      expect(err.hint).toMatch(/already on/i);
      expect(err.hint).not.toMatch(/enable cookie mode/i);
    });

    it("explains rotated / signed-out cookies from the warnings", () => {
      // Real yt-dlp output when the Firefox cookies are no longer accepted.
      const stderr = [
        "WARNING: [youtube] The provided YouTube account cookies are no longer valid. They have likely been rotated in the browser as a security measure.",
        "ERROR: [youtube] 4UoC0ppf4Lo: Sorry, this content is age-restricted. This video is age-restricted and only available on YouTube",
      ].join("\n");
      const err = classifyYtDlpError(null, stderr, { cookieMode: true });
      expect(err.code).toBe("COOKIES_REJECTED");
    });

    it("explains account age-verification", () => {
      const stderr = [
        "[youtube] 4UoC0ppf4Lo: This video is age-restricted and YouTube is requiring account age-verification; some formats may be missing",
        "WARNING: [youtube] 4UoC0ppf4Lo: This video is age-restricted and YouTube is requiring account age-verification; some formats may be missing",
        "ERROR: [youtube] 4UoC0ppf4Lo: Requested format is not available. Use --list-formats for a list of available formats",
      ].join("\n");
      const err = classifyYtDlpError(null, stderr, { cookieMode: true });
      expect(err.code).toBe("AGE_VERIFICATION");
    });

    it("points at the missing JS runtime when challenge solving failed", () => {
      const stderr = [
        "WARNING: [youtube] 4UoC0ppf4Lo: n challenge solving failed: Some formats may be missing. Ensure you have a supported JavaScript runtime and challenge solver script distribution installed.",
        "WARNING: Only images are available for download. Use --list-formats to see them",
        "ERROR: [youtube] 4UoC0ppf4Lo: Requested format is not available. Use --list-formats for a list of available formats",
      ].join("\n");
      const err = classifyYtDlpError(null, stderr, { cookieMode: true });
      expect(err.code).toBe("JS_RUNTIME_MISSING");
      expect(err.hint).toMatch(/deno/i);
    });

    it("still says 'enable cookie mode' when deno is merely absent (cookies off)", () => {
      // Real yt-dlp 2026.10 output: anonymous request, no JS runtime installed.
      const stderr = [
        "WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled by default; to use another runtime add  --js-runtimes RUNTIME[:PATH]  to your command/config. YouTube extraction without a JS runtime has been deprecated, and some formats may be missing.",
        AGE_ERR,
      ].join("\n");
      const err = classifyYtDlpError(null, stderr, { cookieMode: false });
      expect(err.code).toBe("AGE_RESTRICTED");
      expect(err.hint).toMatch(/enable cookie mode/i);
    });

    it("blames the missing runtime when no formats were found without one", () => {
      const stderr = [
        "WARNING: [youtube] No supported JavaScript runtime could be found.",
        "ERROR: [youtube] x: Requested format is not available. Use --list-formats for a list of available formats",
      ].join("\n");
      expect(classifyYtDlpError(null, stderr).code).toBe("JS_RUNTIME_MISSING");
    });

    it("lets ERROR lines win over an age warning", () => {
      const stderr = [
        "WARNING: [youtube] x: This video is age-restricted; some formats may be missing without authentication.",
        "ERROR: [youtube] x: Video unavailable",
      ].join("\n");
      expect(classifyYtDlpError(null, stderr).code).toBe("UNAVAILABLE");
    });

    it("classifies the bot check separately from age restriction", () => {
      const err = classifyYtDlpError(
        null,
        "ERROR: [youtube] x: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication."
      );
      expect(err.code).toBe("BOT_CHECK");
    });

    it("keeps a cookie read failure as a cookie failure", () => {
      const err = classifyYtDlpError(
        null,
        "WARNING: cookies are no longer valid\nERROR: could not find firefox cookies database in C:\\Users\\x",
        { cookieMode: true }
      );
      expect(err.code).toBe("COOKIE_FAILURE");
    });

    it("does not report a WARNING line as the fallback message", () => {
      const err = classifyYtDlpError(null, "WARNING: some error-ish warning\nERROR: boom");
      expect(err.message).toBe("boom");
    });
  });
});

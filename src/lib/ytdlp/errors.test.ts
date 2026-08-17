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
});

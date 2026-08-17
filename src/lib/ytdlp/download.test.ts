import { describe, expect, it } from "vitest";
import { buildDownloadArgs } from "./download";
import { PROGRESS_TEMPLATE } from "./progress";
import type { DownloadRequest } from "@/types";

const CTX = { outputTemplate: "out/%(title)s [%(id)s].%(ext)s" };

const req = (over: Partial<DownloadRequest>): DownloadRequest => ({
  url: "https://example.com/watch?v=abc",
  kind: "video",
  type: "video",
  ...over,
});

describe("buildDownloadArgs", () => {
  it("emits the base flags for a plain video download", () => {
    const args = buildDownloadArgs(
      req({ formatSelector: "137+bestaudio/best", mergeFormat: "mp4" }),
      CTX
    );
    expect(args).toEqual([
      "--newline",
      "--no-warnings",
      "--progress-template",
      PROGRESS_TEMPLATE,
      "-o",
      CTX.outputTemplate,
      "--no-playlist",
      "-f",
      "137+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "https://example.com/watch?v=abc",
    ]);
  });

  it("adds cookie mode flags", () => {
    const args = buildDownloadArgs(req({ cookieMode: true }), CTX);
    expect(args).toContain("--cookies-from-browser");
    expect(args).toContain("firefox");
  });

  it("builds an audio-extraction command", () => {
    const args = buildDownloadArgs(req({ type: "audio", audioFormat: "mp3" }), CTX);
    expect(args).toContain("-x");
    expect(args).toContain("--audio-format");
    expect(args).toContain("mp3");
    expect(args).toContain("--audio-quality");
    expect(args).toContain("0");
    expect(args).not.toContain("-f");
  });

  it("builds a subtitles-only command with skip-download", () => {
    const args = buildDownloadArgs(
      req({
        type: "subtitles",
        subtitles: { langs: ["en"], includeAuto: false, convertToSrt: true, embed: false, subtitlesOnly: true },
      }),
      CTX
    );
    expect(args).toContain("--skip-download");
    expect(args).toContain("--write-subs");
    expect(args).toContain("--sub-langs");
    expect(args).toContain("en");
    expect(args).toContain("--convert-subs");
    expect(args).toContain("srt");
  });

  it("adds archive + ignore-errors for playlists and the best-quality default", () => {
    const args = buildDownloadArgs(
      req({ kind: "playlist", type: "playlist" }),
      { ...CTX, archivePath: "data/archives/x.txt" }
    );
    expect(args).toContain("--yes-playlist");
    expect(args).toContain("--ignore-errors");
    expect(args).toContain("--download-archive");
    expect(args).toContain("data/archives/x.txt");
    const fIdx = args.indexOf("-f");
    expect(args[fIdx + 1]).toBe("bv*+ba/b");
  });

  it("embeds subs only when a media file is produced", () => {
    const args = buildDownloadArgs(
      req({
        subtitles: { langs: ["en"], includeAuto: true, convertToSrt: false, embed: true, subtitlesOnly: false },
      }),
      CTX
    );
    expect(args).toContain("--embed-subs");
    expect(args).toContain("--write-auto-subs");
  });
});

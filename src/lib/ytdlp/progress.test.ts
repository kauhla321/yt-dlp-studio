import { describe, expect, it } from "vitest";
import { parseProgressLine, overallPercent } from "./progress";
import type { ProgressSnapshot } from "@/types";

describe("parseProgressLine", () => {
  it("parses sentinel progress lines", () => {
    const update = parseProgressLine(
      "__YTP__\tdownloading\t 12.3%\t1.2MiB/s\t00:42\tfolder/file.mp4"
    );
    expect(update).toMatchObject({
      percent: 12.3,
      speed: "1.2MiB/s",
      eta: "00:42",
      currentFile: "file.mp4",
      status: "downloading",
    });
  });

  it("maps a finished sentinel to processing at 100%", () => {
    const update = parseProgressLine("__YTP__\tfinished\t100.0%\tNA\tNA\tfile.mp4");
    expect(update).toMatchObject({
      percent: 100,
      speed: null,
      eta: null,
      currentFile: "file.mp4",
      status: "processing",
    });
  });

  it("parses playlist item lines", () => {
    expect(parseProgressLine("[download] Downloading item 3 of 50")).toEqual({
      playlistIndex: 3,
      playlistTotal: 50,
      message: "[download] Downloading item 3 of 50",
    });
    expect(parseProgressLine("Downloading video 12 of 20")).toMatchObject({
      playlistIndex: 12,
      playlistTotal: 20,
    });
  });

  it("maps post-processing lines to processing status", () => {
    expect(parseProgressLine('[ExtractAudio] Destination: out.mp3')).toMatchObject({
      status: "processing",
    });
    expect(parseProgressLine('[Merger] Merging formats into "out.mp4"')).toMatchObject({
      status: "processing",
    });
  });

  it("returns null for unrelated log lines", () => {
    expect(parseProgressLine("[youtube] Extracting URL: https://example.com")).toBeNull();
    expect(parseProgressLine("")).toBeNull();
  });
});

describe("overallPercent", () => {
  it("returns the raw percent without playlist context", () => {
    expect(overallPercent({ percent: 50 } as ProgressSnapshot)).toBe(50);
    expect(overallPercent({ percent: 12.3 } as ProgressSnapshot)).toBe(12);
  });

  it("blends playlist position with per-item percent", () => {
    // Item 2 of 10 at 50% → (1/10)*100 + 50/10 = 10 + 5 = 15
    const snap = {
      percent: 50,
      playlistIndex: 2,
      playlistTotal: 10,
    } as ProgressSnapshot;
    expect(overallPercent(snap)).toBe(15);
  });

  it("reaches 100 only on the last item at 100%", () => {
    const snap = {
      percent: 100,
      playlistIndex: 10,
      playlistTotal: 10,
    } as ProgressSnapshot;
    expect(overallPercent(snap)).toBe(100);
  });

  it("falls back to raw percent when the total is unknown", () => {
    const snap = { percent: 42, playlistIndex: 3 } as ProgressSnapshot;
    expect(overallPercent(snap)).toBe(42);
  });
});

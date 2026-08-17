import { describe, expect, it } from "vitest";
import { bestAudioBytes, parseSubtitles, parseVideoQualities } from "./formats";
import type { RawFormat } from "./formats";

const fmt = (over: Partial<RawFormat> & { format_id: string }): RawFormat => over;

describe("bestAudioBytes", () => {
  it("picks the highest-bitrate audio stream's size", () => {
    const formats = [
      fmt({ format_id: "a1", acodec: "mp4a", abr: 96, filesize_approx: 100 }),
      fmt({ format_id: "a2", acodec: "mp4a", abr: 128, filesize_approx: 200 }),
      fmt({ format_id: "a3", acodec: "mp4a", abr: 64, filesize_approx: 50 }),
    ];
    expect(bestAudioBytes(formats)).toBe(200);
  });

  it("returns null when there is no audio-only stream", () => {
    expect(bestAudioBytes([fmt({ format_id: "v", vcodec: "avc1", acodec: "none" })])).toBeNull();
  });
});

describe("parseVideoQualities", () => {
  it("emits one option per (resolution bucket, container) that exists", () => {
    const options = parseVideoQualities([
      fmt({ format_id: "137", ext: "mp4", vcodec: "avc1", height: 1080, tbr: 4000, filesize: 1000 }),
      fmt({ format_id: "248", ext: "webm", vcodec: "vp9", height: 1080, tbr: 5000, filesize: 1100 }),
      fmt({ format_id: "136", ext: "mp4", vcodec: "avc1", height: 720, tbr: 2000 }),
    ]);
    expect(options.map((o) => o.id)).toEqual(["1080p-mp4", "1080p-webm", "720p-mp4"]);
    // Higher resolution first, then container preference (mp4 before webm).
    expect(options[0]!.container).toBe("mp4");
    expect(options[1]!.container).toBe("webm");
  });

  it("pins the exact format id in the selector and estimates total size", () => {
    const options = parseVideoQualities([
      fmt({ format_id: "137", ext: "mp4", vcodec: "avc1", height: 1080, filesize: 1000 }),
      fmt({ format_id: "140", acodec: "mp4a", abr: 128, filesize_approx: 200 }),
    ]);
    const opt = options[0]!;
    expect(opt.formatSelector).toBe(
      "137+bestaudio[ext=m4a]/bestaudio/137/best[height<=1080]"
    );
    expect(opt.mergeFormat).toBe("mp4");
    expect(opt.estimatedBytes).toBe(1200);
    expect(opt.fps).toBeNull();
    expect(opt.vcodec).toBe("avc1");
  });

  it("uses the webm audio fallback for webm containers", () => {
    const options = parseVideoQualities([
      fmt({ format_id: "248", ext: "webm", vcodec: "vp9", height: 1080 }),
    ]);
    expect(options[0]!.formatSelector).toBe(
      "248+bestaudio[ext=webm]/bestaudio/248/best[height<=1080]"
    );
  });

  it("buckets 4K and low resolutions correctly", () => {
    const options = parseVideoQualities([
      fmt({ format_id: "a", ext: "mp4", vcodec: "avc1", height: 2160 }),
      fmt({ format_id: "b", ext: "mp4", vcodec: "avc1", height: 100 }),
    ]);
    expect(options[0]!.label).toBe("4K");
    expect(options[0]!.formatSelector).toContain("best[height<=2160]");
    expect(options[1]!.label).toBe("144p");
    expect(options[1]!.formatSelector).toContain("best[height<=240]");
  });

  it("keeps the higher-bitrate stream within a group", () => {
    const options = parseVideoQualities([
      fmt({ format_id: "137", ext: "mp4", vcodec: "avc1", height: 1080, tbr: 3000 }),
      fmt({ format_id: "137b", ext: "mp4", vcodec: "avc1", height: 1080, tbr: 6000 }),
    ]);
    expect(options).toHaveLength(1);
    expect(options[0]!.formatSelector).toContain("137b+");
  });
});

describe("parseSubtitles", () => {
  it("lists human tracks first (alphabetical), then auto tracks", () => {
    const tracks = parseSubtitles(
      { fr: {}, en: {} },
      { en: {}, es: {} }
    );
    expect(tracks.map((t) => `${t.langCode}:${t.auto}`)).toEqual([
      "en:false",
      "fr:false",
      "en:true",
      "es:true",
    ]);
  });

  it("maps known language codes to names", () => {
    const [en] = parseSubtitles({ en: {} }, undefined);
    expect(en!.langName).toBe("English");
    const [es] = parseSubtitles({ es: {} }, undefined);
    expect(es!.langName).toBe("Spanish");
  });
});

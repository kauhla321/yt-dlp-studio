import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PlaylistState } from "@/types";

// json-store reads YTP_DATA_DIR at import time, so point it at a temp dir and
// dynamically import the store fresh for each test.
let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ytp-test-"));
  process.env.YTP_DATA_DIR = tmp;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.YTP_DATA_DIR;
});

const state = (id: string, archivePath: string, outputDir: string): PlaylistState => ({
  id,
  title: `Playlist ${id}`,
  url: `https://example.com/playlist?list=${id}`,
  total: 10,
  completed: 3,
  archivePath,
  outputDir,
  request: { url: "https://example.com", kind: "playlist", type: "playlist" },
  status: "interrupted",
  updatedAt: Date.now(),
});

describe("removePlaylistState", () => {
  it("forgets the playlist and its archive but keeps downloaded files", async () => {
    const store = await import("./playlist-state");
    const archive = path.join(tmp, "a.txt");
    const outDir = path.join(tmp, "out");
    fs.writeFileSync(archive, "youtube abc\nyoutube def\n");
    fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, "video.mp4"), "x");

    await store.savePlaylistState(state("keep", path.join(tmp, "k.txt"), outDir));
    await store.savePlaylistState(state("gone", archive, outDir));

    expect(await store.removePlaylistState("gone")).toBe(true);
    expect((await store.getPlaylistStates()).map((p) => p.id)).toEqual(["keep"]);
    expect(fs.existsSync(archive)).toBe(false);
    expect(fs.existsSync(path.join(outDir, "video.mp4"))).toBe(true);
  });

  it("returns false for an unknown id", async () => {
    const store = await import("./playlist-state");
    expect(await store.removePlaylistState("nope")).toBe(false);
  });
});

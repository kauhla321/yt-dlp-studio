import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HistoryEntry } from "@/types";

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

const entry = (i: number): HistoryEntry => ({
  id: `job-${i}`,
  title: `Title ${i}`,
  url: `https://example.com/video/${i}`,
  date: i,
  outputLocation: "C:\\out",
  type: "video",
  status: "completed",
});

describe("history store", () => {
  it("round-trips entries sorted newest first", async () => {
    const { upsertHistory, getHistory } = await import("./history");
    await upsertHistory(entry(1));
    await upsertHistory(entry(2));
    const list = await getHistory();
    expect(list.map((e) => e.id)).toEqual(["job-2", "job-1"]);
  });

  it("prunes the file to the newest 500 entries", async () => {
    const { upsertHistory, getHistory } = await import("./history");
    for (let i = 0; i < 505; i++) {
      await upsertHistory(entry(i));
    }
    const list = await getHistory();
    expect(list).toHaveLength(500);
    expect(list[0]!.id).toBe("job-504");
    expect(list[499]!.id).toBe("job-5");
  });

  it("updates an existing entry by id instead of duplicating", async () => {
    const { upsertHistory, getHistory } = await import("./history");
    await upsertHistory(entry(1));
    await upsertHistory({ ...entry(1), title: "Renamed" });
    const list = await getHistory();
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe("Renamed");
  });

  it("clears all entries", async () => {
    const { upsertHistory, clearHistory, getHistory } = await import("./history");
    await upsertHistory(entry(1));
    await clearHistory();
    expect(await getHistory()).toEqual([]);
  });
});

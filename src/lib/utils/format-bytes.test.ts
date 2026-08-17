import { describe, expect, it } from "vitest";
import { formatBytes, formatCount, formatDuration, formatUploadDate } from "./format-bytes";

describe("formatBytes", () => {
  it("formats binary units", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KiB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MiB");
  });

  it("returns an em dash for missing/invalid values", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats seconds into M:SS or H:MM:SS", () => {
    expect(formatDuration(61)).toBe("1:01");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("returns an em dash for missing/invalid values", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
  });
});

describe("formatCount", () => {
  it("compacts large counts", () => {
    expect(formatCount(932)).toBe("932");
    expect(formatCount(14_300)).toBe("14.3K");
    expect(formatCount(1_234_567)).toBe("1.2M");
    expect(formatCount(2_000_000_000)).toBe("2.0B");
  });

  it("returns an em dash for missing values", () => {
    expect(formatCount(null)).toBe("—");
  });
});

describe("formatUploadDate", () => {
  it("converts YYYYMMDD to ISO YYYY-MM-DD", () => {
    expect(formatUploadDate("20240315")).toBe("2024-03-15");
  });

  it("passes through anything unexpected", () => {
    expect(formatUploadDate(null)).toBeNull();
    expect(formatUploadDate("2024")).toBe("2024");
  });
});

import { describe, expect, it } from "vitest";
import { hashId, isValidUrl, sanitizeFolderName } from "./sanitize";

describe("sanitizeFolderName", () => {
  it("replaces Windows-illegal characters with spaces", () => {
    expect(sanitizeFolderName('My: Video?"')).toBe("My Video");
  });

  it("collapses whitespace and strips trailing dots/spaces", () => {
    expect(sanitizeFolderName("  lots   of  space  ")).toBe("lots of space");
    expect(sanitizeFolderName("name.")).toBe("name");
  });

  it("falls back for empty or reserved device names", () => {
    expect(sanitizeFolderName("")).toBe("Untitled");
    expect(sanitizeFolderName("   ")).toBe("Untitled");
    expect(sanitizeFolderName("CON")).toBe("Untitled");
    expect(sanitizeFolderName("nul.txt")).toBe("Untitled");
  });

  it("caps folder names at 180 characters", () => {
    const long = "x".repeat(300);
    expect(sanitizeFolderName(long).length).toBe(180);
  });
});

describe("isValidUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isValidUrl("https://youtube.com/watch?v=abc")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("hashId", () => {
  it("is stable for the same input", () => {
    expect(hashId("https://example.com/playlist?list=x")).toBe(
      hashId("https://example.com/playlist?list=x")
    );
  });

  it("differs for different inputs", () => {
    expect(hashId("a")).not.toBe(hashId("b"));
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemStatus, ToolInstallStatus } from "@/types";

// The store talks to the server only through the api client — mock it and
// drive the state machine with fake timers (no DOM needed).
vi.mock("@/lib/client", () => ({
  api: {
    tools: vi.fn(),
    installTool: vi.fn(),
  },
}));

const IDLE_FFMPEG: ToolInstallStatus = { tool: "ffmpeg", state: "idle", percent: 0 };

function system(ytdlpAvail: boolean, ffmpegAvail = false): SystemStatus {
  return {
    ytdlp: {
      available: ytdlpAvail,
      version: ytdlpAvail ? "2026.07.04" : undefined,
      source: ytdlpAvail ? "local" : "none",
    },
    ffmpeg: {
      available: ffmpegAvail,
      version: ffmpegAvail ? "8.1" : undefined,
      source: ffmpegAvail ? "local" : "none",
    },
    firefox: { available: false, profilesFound: false },
    binDir: "C:\\app",
    canInstall: true,
  };
}

function toolsResponse(state: ToolInstallStatus["state"], ytdlpAvail: boolean, percent = 0) {
  return {
    system: system(ytdlpAvail),
    installs: {
      ytdlp: { tool: "ytdlp", state, percent },
      ffmpeg: IDLE_FFMPEG,
    },
  };
}

type Store = typeof import("./status-store");

async function freshStore(): Promise<{
  store: Store;
  tools: ReturnType<typeof vi.fn>;
  installTool: ReturnType<typeof vi.fn>;
}> {
  const store = await import("./status-store");
  const { api } = await import("@/lib/client");
  return {
    store,
    tools: api.tools as ReturnType<typeof vi.fn>,
    installTool: api.installTool as ReturnType<typeof vi.fn>,
  };
}

describe("status-store", () => {
  beforeEach(() => {
    // Fresh module state per test (the store is module-level).
    vi.resetModules();
    // The mocked api module is cached across resetModules — clear call
    // history and queued responses so tests never see each other's state.
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refresh publishes fresh state to subscribers", async () => {
    const { store, tools } = await freshStore();
    tools.mockResolvedValue(toolsResponse("idle", true));

    const seen: unknown[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));

    await store.refresh();

    expect(seen.length).toBeGreaterThan(0);
    expect(store.getSnapshot().system?.ytdlp.available).toBe(true);
    expect(store.getSnapshot().installs?.ytdlp.state).toBe("idle");
  });

  it("shows an optimistic busy state immediately and polls until done + verified", async () => {
    const { store, tools, installTool } = await freshStore();
    installTool.mockResolvedValue({ tool: "ytdlp", state: "downloading", percent: 0 });
    tools
      .mockResolvedValueOnce(toolsResponse("downloading", false, 40))
      .mockResolvedValueOnce(toolsResponse("downloading", false, 80))
      .mockResolvedValueOnce(toolsResponse("done", true, 100));

    await store.install("ytdlp");

    // The very first poll runs immediately → progress visible right away.
    expect(store.getSnapshot().installing).toBe("ytdlp");
    expect(store.getSnapshot().installs?.ytdlp.percent).toBe(40);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.getSnapshot().installs?.ytdlp.percent).toBe(80);

    await vi.advanceTimersByTimeAsync(1_000);
    const snap = store.getSnapshot();
    expect(snap.installing).toBeNull();
    expect(snap.system?.ytdlp.available).toBe(true);
    expect(snap.verificationError).toBeNull();

    // Polling has stopped — no further requests.
    const callsBefore = tools.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(tools.mock.calls.length).toBe(callsBefore);
  });

  it("keeps polling after 'done' until the tool is actually detected", async () => {
    const { store, tools } = await freshStore();
    tools
      // 1st response is consumed by the immediate first tick inside install().
      .mockResolvedValueOnce(toolsResponse("done", false, 100))
      .mockResolvedValueOnce(toolsResponse("done", false, 100))
      .mockResolvedValueOnce(toolsResponse("done", false, 100))
      .mockResolvedValueOnce(toolsResponse("done", true, 100));

    await store.install("ytdlp");

    // Two interval ticks where the probe still fails (e.g. Defender scanning).
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.getSnapshot().installing).toBe("ytdlp");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.getSnapshot().installing).toBe("ytdlp");

    // Third tick: probe succeeds → install settles.
    await vi.advanceTimersByTimeAsync(1_000);
    const snap = store.getSnapshot();
    expect(snap.installing).toBeNull();
    expect(snap.system?.ytdlp.available).toBe(true);
  });

  it("surfaces a verification error after the grace period instead of freezing", async () => {
    const { store, tools } = await freshStore();
    tools.mockResolvedValue(toolsResponse("done", false, 100));

    await store.install("ytdlp");
    await vi.advanceTimersByTimeAsync(46_000); // grace is 45s, polls every 1s

    const snap = store.getSnapshot();
    expect(snap.installing).toBeNull();
    expect(snap.verificationError?.tool).toBe("ytdlp");
    expect(snap.verificationError?.message).toContain("could not be verified");
  });

  it("clears the verification error once the tool becomes detectable", async () => {
    const { store, tools } = await freshStore();
    tools.mockResolvedValue(toolsResponse("done", false, 100));

    await store.install("ytdlp");
    await vi.advanceTimersByTimeAsync(46_000);
    expect(store.getSnapshot().verificationError).not.toBeNull();

    // A later probe (e.g. window refocus) finds the binary → error cleared.
    tools.mockResolvedValue(toolsResponse("done", true, 100));
    await store.refresh();
    expect(store.getSnapshot().verificationError).toBeNull();
  });

  it("stops polling when the install errors, keeping the server message", async () => {
    const { store, tools } = await freshStore();
    // errors carry a message in the install status
    tools.mockResolvedValue({
      system: system(false),
      installs: {
        ytdlp: { tool: "ytdlp", state: "error", percent: 0, message: "Download failed (500)" },
        ffmpeg: IDLE_FFMPEG,
      },
    });

    await store.install("ytdlp");
    await vi.advanceTimersByTimeAsync(2_000);

    const snap = store.getSnapshot();
    expect(snap.installing).toBeNull();
    expect(snap.installs?.ytdlp.state).toBe("error");
    expect(snap.installs?.ytdlp.message).toContain("Download failed");
    expect(snap.verificationError).toBeNull();
  });

  it("restarts the poll loop when a second install is started (single-flight)", async () => {
    const { store, tools, installTool } = await freshStore();
    tools.mockResolvedValue(toolsResponse("downloading", false, 10));
    installTool.mockResolvedValue({ tool: "ytdlp", state: "downloading", percent: 0 });

    await store.install("ytdlp");
    expect(store.getSnapshot().installing).toBe("ytdlp");

    await store.install("ffmpeg");
    expect(store.getSnapshot().installing).toBe("ffmpeg");
    expect(installTool).toHaveBeenCalledTimes(2);
  });
});

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { binDir, isWritable, pickInstallDir, toolInstallPath } from "./paths";
import type { ToolInstallStatus, ToolName } from "@/types";

// Windows download sources. (The shipping target is Windows; other platforms
// are guided to install manually.)
const YTDLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
// GitHub-hosted ffmpeg build (BtbN). Served from GitHub's CDN, which is far
// faster and more reliable than the gyan.dev mirror. Binaries live under
// ffmpeg-*/bin/ inside the archive (handled by findFiles).
const FFMPEG_ZIP_URL =
  "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip";

/** In-memory install state, shared across requests / hot reloads. */
class InstallerState {
  private status = new Map<ToolName, ToolInstallStatus>();

  get(tool: ToolName): ToolInstallStatus {
    return this.status.get(tool) ?? { tool, state: "idle", percent: 0 };
  }

  set(tool: ToolName, patch: Partial<ToolInstallStatus>) {
    this.status.set(tool, { ...this.get(tool), tool, ...patch });
  }

  isBusy(tool: ToolName): boolean {
    const s = this.get(tool).state;
    return s === "downloading" || s === "extracting";
  }
}

const KEY = "__ytp_installer_state__";
const g = globalThis as unknown as Record<string, InstallerState | undefined>;
const state: InstallerState = g[KEY] ?? (g[KEY] = new InstallerState());

export function getInstallStatus(tool: ToolName): ToolInstallStatus {
  return state.get(tool);
}

/**
 * Kick off (or no-op if already running) an install. Returns immediately;
 * progress is read via {@link getInstallStatus} (the API polls it).
 */
export function startInstall(tool: ToolName): ToolInstallStatus {
  if (process.platform !== "win32") {
    state.set(tool, {
      state: "error",
      percent: 0,
      message:
        "Automatic install is only available on Windows. Please install the tool manually and place it next to the app.",
    });
    return state.get(tool);
  }
  if (state.isBusy(tool)) return state.get(tool);

  // Tools are installed only in the app's folder — fail clearly if it's not writable.
  const dir = binDir();
  if (!isWritable(dir)) {
    state.set(tool, {
      state: "error",
      percent: 0,
      message: `Can't write to ${dir}. Move the app to a writable location (e.g. Desktop or Downloads) and try again.`,
    });
    return state.get(tool);
  }

  state.set(tool, { state: "downloading", percent: 0, message: "Starting…" });
  // Run in the background; errors are captured into state.
  void runInstall(tool).catch((err) => {
    state.set(tool, {
      state: "error",
      percent: 0,
      message: err instanceof Error ? err.message : String(err),
    });
  });
  return state.get(tool);
}

async function runInstall(tool: ToolName) {
  if (tool === "ytdlp") await installYtDlp();
  else await installFfmpeg();
}

/** Stream a URL to disk, reporting percent into installer state. */
async function download(url: string, dest: string, tool: ToolName) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) for ${url}`);
  }
  const total = Number(res.headers.get("content-length") ?? 0);
  let received = 0;

  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest);
  const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (total > 0) {
      // Reserve the last 10% for extraction on tools that need it.
      const pct = Math.min(100, Math.round((received / total) * 100));
      state.set(tool, { percent: tool === "ffmpeg" ? Math.round(pct * 0.85) : pct });
    }
  });
  await pipeline(body, out);
}

async function installYtDlp() {
  const dest = toolInstallPath("ytdlp");
  state.set("ytdlp", { state: "downloading", message: "Downloading yt-dlp…" });
  await download(YTDLP_URL, dest, "ytdlp");
  state.set("ytdlp", { state: "done", percent: 100, message: "yt-dlp installed.", path: dest });
}

async function installFfmpeg() {
  const installDir = pickInstallDir();
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ytp-ffmpeg-"));
  const zipPath = path.join(tmpDir, "ffmpeg.zip");

  try {
    state.set("ffmpeg", { state: "downloading", message: "Downloading ffmpeg…" });
    await download(FFMPEG_ZIP_URL, zipPath, "ffmpeg");

    state.set("ffmpeg", { state: "extracting", percent: 90, message: "Extracting ffmpeg…" });
    await fsp.mkdir(installDir, { recursive: true });
    // Pull only the two binaries we need straight out of the archive (the full
    // build is large; extracting everything would be slow and wasteful).
    const extracted = await extractEntries(zipPath, ["ffmpeg.exe", "ffprobe.exe"], installDir);
    if (!extracted.includes("ffmpeg.exe")) {
      throw new Error("ffmpeg.exe not found in the downloaded archive.");
    }

    const dest = path.join(installDir, "ffmpeg.exe");
    state.set("ffmpeg", { state: "done", percent: 100, message: "ffmpeg installed.", path: dest });
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Stream specific files (by basename) out of a zip directly to `destDir`,
 * without unpacking the whole archive. Returns the basenames written.
 */
function extractEntries(
  zipPath: string,
  wantedNames: string[],
  destDir: string
): Promise<string[]> {
  const want = new Set(wantedNames.map((n) => n.toLowerCase()));
  const written: string[] = [];

  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Could not open archive."));

      zip.on("error", reject);
      zip.on("end", () => resolve(written));
      zip.readEntry();

      zip.on("entry", (entry) => {
        const base = entry.fileName.split("/").pop() ?? entry.fileName;
        const isDir = /\/$/.test(entry.fileName);
        if (isDir || !want.has(base.toLowerCase())) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (rsErr, rs) => {
          if (rsErr || !rs) return reject(rsErr ?? new Error("Read stream failed."));
          const out = fs.createWriteStream(path.join(destDir, base));
          rs.pipe(out);
          out.on("error", reject);
          out.on("close", () => {
            written.push(base);
            zip.readEntry();
          });
        });
      });
    });
  });
}

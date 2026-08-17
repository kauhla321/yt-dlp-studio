import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runCollect } from "./exec";
import { binDir, resolveTool } from "@/lib/tools/paths";
import type { SystemStatus, ToolSource } from "@/types";

async function probeVersion(
  bin: string,
  args: string[]
): Promise<{ available: boolean; version?: string }> {
  try {
    const { code, stdout, stderr } = await runCollect(bin, args, { timeoutMs: 8000 });
    if (code === 0) {
      const version = (stdout || stderr).trim().split(/\r?\n/)[0];
      return { available: true, version };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

/**
 * Detect whether Firefox has at least one usable profile, so cookie mode
 * can fail fast with a clear message instead of mid-download.
 */
async function detectFirefox(): Promise<{ available: boolean; profilesFound: boolean }> {
  const home = os.homedir();
  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    candidates.push(path.join(appData, "Mozilla", "Firefox", "profiles.ini"));
  } else if (platform === "darwin") {
    candidates.push(
      path.join(home, "Library", "Application Support", "Firefox", "profiles.ini")
    );
  } else {
    candidates.push(
      path.join(home, ".mozilla", "firefox", "profiles.ini"),
      path.join(home, "snap", "firefox", "common", ".mozilla", "firefox", "profiles.ini")
    );
  }

  for (const iniPath of candidates) {
    try {
      const content = await fs.readFile(iniPath, "utf8");
      const profilesFound = /\[Profile\d+\]/i.test(content) || /Path=/.test(content);
      return { available: true, profilesFound };
    } catch {
      // try next candidate
    }
  }
  return { available: false, profilesFound: false };
}

/** Full environment probe used by the /api/system route and the UI banner. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const ytdlpResolved = resolveTool("yt-dlp");
  const ffmpegResolved = resolveTool("ffmpeg");

  const [ytdlp, ffmpeg, firefox] = await Promise.all([
    probeVersion(ytdlpResolved.command, ["--version"]),
    probeVersion(ffmpegResolved.command, ["-version"]),
    detectFirefox(),
  ]);

  // If a probe failed, the tool isn't really there → source "none".
  const sourceOf = (available: boolean, resolved: ToolSource): ToolSource =>
    available ? resolved : "none";

  return {
    ytdlp: {
      available: ytdlp.available,
      version: ytdlp.version,
      path: ytdlpResolved.command,
      source: sourceOf(ytdlp.available, ytdlpResolved.source),
    },
    ffmpeg: {
      available: ffmpeg.available,
      // ffmpeg -version first line: "ffmpeg version X ..."
      version: ffmpeg.version?.replace(/^ffmpeg version\s*/i, "").split(" ")[0],
      path: ffmpegResolved.command,
      source: sourceOf(ffmpeg.available, ffmpegResolved.source),
    },
    firefox,
    binDir: binDir(),
    canInstall: process.platform === "win32",
  };
}

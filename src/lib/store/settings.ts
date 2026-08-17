import os from "node:os";
import path from "node:path";
import { readJson, writeJson } from "./json-store";
import type { AppSettings } from "@/types";

const FILE = "settings.json";

function defaults(): AppSettings {
  const home = os.homedir();
  return {
    videoOutputDir: path.join(home, "Downloads", "yt-dlp", "Videos"),
    playlistOutputDir: path.join(home, "Downloads", "yt-dlp", "Playlists"),
    cookieModeDefault: false,
    maxConcurrent: 2,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await readJson<Partial<AppSettings>>(FILE, {});
  return { ...defaults(), ...stored };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };
  // Guard against nonsensical concurrency values.
  next.maxConcurrent = Math.max(1, Math.min(6, Math.floor(next.maxConcurrent)));
  await writeJson(FILE, next);
  return next;
}

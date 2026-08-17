import fs from "node:fs/promises";
import { readJson, writeJson, dataPath } from "./json-store";
import type { PlaylistState } from "@/types";

const FILE = "playlists.json";

export async function getPlaylistStates(): Promise<PlaylistState[]> {
  const list = await readJson<PlaylistState[]>(FILE, []);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPlaylistState(id: string): Promise<PlaylistState | undefined> {
  const list = await getPlaylistStates();
  return list.find((p) => p.id === id);
}

export async function savePlaylistState(state: PlaylistState): Promise<void> {
  const list = await readJson<PlaylistState[]>(FILE, []);
  const idx = list.findIndex((p) => p.id === state.id);
  if (idx >= 0) list[idx] = state;
  else list.push(state);
  await writeJson(FILE, list);
}

/**
 * Count how many videos a playlist has already completed by counting the
 * lines recorded in its yt-dlp --download-archive file. This is the source
 * of truth for resuming, and survives process/computer restarts.
 */
export async function countArchive(archivePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(archivePath, "utf8");
    return raw.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

export function archivePathFor(id: string): string {
  return dataPath("archives", `${id}.txt`);
}

/**
 * On startup, any playlist still marked "downloading" was interrupted
 * (the process died mid-download). Promote it to "interrupted" so the UI
 * can offer Resume / Start Over.
 */
export async function reconcileInterrupted(): Promise<void> {
  const list = await readJson<PlaylistState[]>(FILE, []);
  let changed = false;
  for (const p of list) {
    if (p.status === "downloading") {
      p.status = "interrupted";
      p.completed = await countArchive(p.archivePath);
      changed = true;
    }
  }
  if (changed) await writeJson(FILE, list);
}

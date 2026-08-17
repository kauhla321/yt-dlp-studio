import { readJson, writeJson } from "./json-store";
import type { HistoryEntry } from "@/types";

const FILE = "history.json";

/** Newest entries kept on disk; older ones are pruned on write. */
const HISTORY_LIMIT = 500;

export async function getHistory(): Promise<HistoryEntry[]> {
  const list = await readJson<HistoryEntry[]>(FILE, []);
  return list.sort((a, b) => b.date - a.date);
}

/** Update an existing entry by id (merging fields), or insert if absent. */
export async function upsertHistory(entry: HistoryEntry): Promise<void> {
  const list = await readJson<HistoryEntry[]>(FILE, []);
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  // Keep only the newest entries so the file can't grow forever.
  list.sort((a, b) => b.date - a.date);
  if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
  await writeJson(FILE, list);
}

export async function clearHistory(): Promise<void> {
  await writeJson(FILE, []);
}

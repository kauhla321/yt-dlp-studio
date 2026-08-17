import fs from "node:fs/promises";
import path from "node:path";

/** Root directory for all persisted runtime state. */
export const DATA_DIR = process.env.YTP_DATA_DIR || path.join(process.cwd(), "data");

let ensured = false;
async function ensureDir() {
  if (ensured) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, "archives"), { recursive: true });
  ensured = true;
}

export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}

/** Read and parse a JSON file, returning `fallback` if it is missing/corrupt. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDir();
  try {
    const raw = await fs.readFile(dataPath(file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Atomically write JSON (write to temp, then rename) to avoid corruption. */
export async function writeJson<T>(file: string, value: T): Promise<void> {
  await ensureDir();
  const target = dataPath(file);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, target);
}

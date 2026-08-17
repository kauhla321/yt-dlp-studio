import fs from "node:fs";
import path from "node:path";
import type { ToolName, ToolSource } from "@/types";

/** Map our short tool id to the binary base name yt-dlp/ffmpeg use. */
export const TOOL_BINARY: Record<ToolName, string> = {
  ytdlp: "yt-dlp",
  ffmpeg: "ffmpeg",
};

/**
 * The folder the app lives in and looks for / installs tools into.
 * For a packaged portable Electron app this is the directory containing the
 * .exe (electron-builder sets PORTABLE_EXECUTABLE_DIR); Electron's main
 * process forwards it as YTP_BIN_DIR. Falls back to the process cwd in dev.
 */
export function binDir(): string {
  return (
    process.env.YTP_BIN_DIR ||
    process.env.PORTABLE_EXECUTABLE_DIR ||
    process.cwd()
  );
}

function existing(...candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {
      // ignore and try next
    }
  }
  return null;
}

/** Candidate file names for a tool on the current platform. */
function binaryNames(base: string): string[] {
  return process.platform === "win32" ? [`${base}.exe`, base] : [base];
}

/**
 * Resolve the command to spawn for a tool. Preference order:
 *   1. explicit env override (YT_DLP_PATH / FFMPEG_PATH)
 *   2. the app folder (next to the exe) and its bin/ subfolder
 *   3. the bare command name → relies on the system PATH
 */
export function resolveTool(base: "yt-dlp" | "ffmpeg"): {
  command: string;
  source: ToolSource;
} {
  const override =
    base === "yt-dlp" ? process.env.YT_DLP_PATH : process.env.FFMPEG_PATH;
  if (override && existing(override)) {
    return { command: override, source: "local" };
  }

  const dir = binDir();
  const names = binaryNames(base);
  const localCandidates = [
    ...names.map((n) => path.join(dir, n)),
    ...names.map((n) => path.join(dir, "bin", n)),
  ];
  const found = existing(...localCandidates);
  if (found) return { command: found, source: "local" };

  // Fall back to PATH lookup by bare name.
  return { command: base, source: "path" };
}

/** Whether files can be created in `dir` (creating it if needed). */
export function isWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where tools are installed: always the app's working directory (next to the
 * exe / cwd). Tools are kept alongside the app — never elsewhere.
 */
export function pickInstallDir(): string {
  return binDir();
}

/** Absolute path a tool will be installed to (inside the app folder). */
export function toolInstallPath(tool: ToolName, dir = pickInstallDir()): string {
  const base = TOOL_BINARY[tool];
  const name = process.platform === "win32" ? `${base}.exe` : base;
  return path.join(dir, name);
}

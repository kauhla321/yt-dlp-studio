import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveTool } from "@/lib/tools/paths";

/**
 * Resolve the yt-dlp binary to spawn. Prefers an explicit YT_DLP_PATH, then a
 * copy sitting next to the app (the portable folder), then the system PATH.
 */
export function ytDlpBinary(): string {
  return resolveTool("yt-dlp").command;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run a command to completion and collect stdout/stderr.
 * Throws a tagged error if the binary cannot be spawned (ENOENT).
 */
export function runCollect(
  command: string,
  args: string[],
  opts: { timeoutMs?: number } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch (err) {
      reject(taggedSpawnError(command, err));
      return;
    }

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Command timed out after ${opts.timeoutMs}ms: ${command}`));
      }, opts.timeoutMs);
    }

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(taggedSpawnError(command, err));
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Spawn a long-running command and stream output line-by-line.
 * Returns the child so callers can kill it (cancel / shutdown).
 */
export function runStream(
  command: string,
  args: string[],
  handlers: {
    onStdoutLine?: (line: string) => void;
    onStderrLine?: (line: string) => void;
    onClose?: (code: number | null) => void;
    onError?: (err: Error) => void;
  }
): ChildProcessWithoutNullStreams {
  const child = spawn(command, args, { windowsHide: true });

  lineReader(child, "stdout", handlers.onStdoutLine);
  lineReader(child, "stderr", handlers.onStderrLine);

  child.on("error", (err) => handlers.onError?.(taggedSpawnError(command, err)));
  child.on("close", (code) => handlers.onClose?.(code));
  return child;
}

/**
 * Forcefully terminate a spawned process AND its children.
 * On Windows `child.kill()` only kills the direct process; yt-dlp.exe (a
 * PyInstaller bundle) and any ffmpeg it spawns run as children that would be
 * orphaned and keep downloading. `taskkill /T` walks the whole tree.
 */
export function killProcessTree(child: ChildProcessWithoutNullStreams) {
  if (child.pid == null) {
    child.kill("SIGKILL");
    return;
  }
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
    } catch {
      child.kill("SIGKILL");
    }
  } else {
    child.kill("SIGKILL");
  }
}

function lineReader(
  child: ChildProcessWithoutNullStreams,
  stream: "stdout" | "stderr",
  cb?: (line: string) => void
) {
  if (!cb) return;
  let buffer = "";
  child[stream].on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    // yt-dlp uses \r for in-place progress updates; split on both.
    const parts = buffer.split(/\r\n|\r|\n/);
    buffer = parts.pop() ?? "";
    for (const line of parts) cb(line);
  });
  child[stream].on("end", () => {
    if (buffer.length) cb(buffer);
  });
}

function taggedSpawnError(command: string, err: unknown): Error {
  const e = err as NodeJS.ErrnoException;
  if (e?.code === "ENOENT") {
    const wrapped = new Error(`Executable not found: ${command}`);
    (wrapped as NodeJS.ErrnoException).code = "ENOENT";
    return wrapped;
  }
  return e instanceof Error ? e : new Error(String(err));
}

import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/open — reveal a download folder (or file) in the system file
 * manager. Windows-only (the shipping target); the path must be absolute and
 * must still exist. The server spawns `explorer.exe` directly with argv (no
 * shell), so no command injection is possible.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { path?: string };
  const target = body.path?.trim() ?? "";
  if (!target || !path.isAbsolute(target)) {
    return fail("A valid absolute path is required.", 400);
  }
  if (!fs.existsSync(target)) {
    return fail("That path no longer exists.", 404);
  }
  if (process.platform !== "win32") {
    return fail("Opening folders is only supported on Windows.", 501);
  }

  // A directory just opens; a file is selected inside Explorer.
  const stat = fs.statSync(target);
  const arg = stat.isDirectory() ? target : `/select,${target}`;
  const child = spawn("explorer.exe", [arg], { detached: true, stdio: "ignore" });
  child.unref();
  return ok({ opened: true });
});

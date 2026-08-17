import { NextRequest } from "next/server";
import { getInstallStatus, startInstall } from "@/lib/tools/installer";
import { getSystemStatus } from "@/lib/ytdlp/system";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";
import type { SystemStatus, ToolName } from "@/types";

export const dynamic = "force-dynamic";
// ffmpeg's archive download can take a while on slow links.
export const maxDuration = 300;

const TOOLS: ToolName[] = ["ytdlp", "ffmpeg"];

// The system probe spawns subprocesses and is by far the slow part of this
// endpoint (~1s+ per call), and the UI polls it every second during installs.
// Reuse the last probe for a short TTL, and while an install is mid-flight
// (the binary cannot have appeared yet, so probing is pure waste).
let lastProbe: { at: number; system: SystemStatus } | null = null;
let lastBusy = false;
const PROBE_TTL_MS = 2_000;

/** GET /api/tools — install state for each tool + a (cached) system probe. */
export const GET = withErrorHandling(async () => {
  const installs = {
    ytdlp: getInstallStatus("ytdlp"),
    ffmpeg: getInstallStatus("ffmpeg"),
  };
  const busy = Object.values(installs).some(
    (s) => s.state === "downloading" || s.state === "extracting"
  );
  // The moment an install completes, force a fresh probe so "done" and
  // "available" arrive together instead of serving a stale pre-install probe.
  const installJustFinished = lastBusy && !busy;
  lastBusy = busy;

  const cached = lastProbe;
  const fresh =
    !cached ||
    installJustFinished ||
    (!busy && Date.now() - cached.at >= PROBE_TTL_MS);
  const system = fresh ? await getSystemStatus() : cached.system;
  if (fresh) lastProbe = { at: Date.now(), system };

  return ok({ system, installs });
});

/** POST /api/tools — body: { tool } — start installing yt-dlp or ffmpeg. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { tool?: string };
  if (!body.tool || !TOOLS.includes(body.tool as ToolName)) {
    return fail("Specify which tool to install: 'ytdlp' or 'ffmpeg'.", 400);
  }
  const status = startInstall(body.tool as ToolName);
  return ok(status, { status: 202 });
});

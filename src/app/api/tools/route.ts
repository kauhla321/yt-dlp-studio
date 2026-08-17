import { NextRequest } from "next/server";
import { getInstallStatus, startInstall } from "@/lib/tools/installer";
import { getSystemStatus } from "@/lib/ytdlp/system";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";
import type { ToolName } from "@/types";

export const dynamic = "force-dynamic";
// ffmpeg's archive download can take a while on slow links.
export const maxDuration = 300;

const TOOLS: ToolName[] = ["ytdlp", "ffmpeg"];

/** GET /api/tools — install state for each tool + a fresh system probe. */
export const GET = withErrorHandling(async () => {
  const system = await getSystemStatus();
  return ok({
    system,
    installs: {
      ytdlp: getInstallStatus("ytdlp"),
      ffmpeg: getInstallStatus("ffmpeg"),
    },
  });
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

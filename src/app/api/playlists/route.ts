import { NextRequest } from "next/server";
import { getPlaylistStates } from "@/lib/store/playlist-state";
import { queueManager } from "@/lib/queue/manager";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/playlists — list saved playlist states (for resume UI). */
export const GET = withErrorHandling(async () => {
  // Ensure interrupted playlists from a previous run are reconciled.
  await queueManager.boot();
  const playlists = await getPlaylistStates();
  return ok({ playlists });
});

/** POST /api/playlists/resume — body: { id }. Resumes from the archive file. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return fail("Missing playlist id.", 400);
  const jobId = await queueManager.resumePlaylist(body.id);
  return ok({ jobId }, { status: 202 });
});

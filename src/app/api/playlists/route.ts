import { NextRequest } from "next/server";
import { getPlaylistState, getPlaylistStates, removePlaylistState } from "@/lib/store/playlist-state";
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

/**
 * DELETE /api/playlists — body: { id }. Dismiss an interrupted playlist so it
 * stops showing up as resumable. Downloaded files are kept on disk.
 */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return fail("Missing playlist id.", 400);
  const state = await getPlaylistState(body.id);
  if (!state) return fail("That playlist is no longer saved.", 404);
  if (state.status === "downloading") {
    return fail("This playlist is still downloading. Cancel it first.", 409);
  }
  await removePlaylistState(body.id);
  return ok({ removed: true });
});

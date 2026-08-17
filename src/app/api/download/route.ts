import { NextRequest } from "next/server";
import { queueManager } from "@/lib/queue/manager";
import { isValidUrl } from "@/lib/utils/sanitize";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";
import type { DownloadRequest } from "@/types";

export const dynamic = "force-dynamic";

/** GET /api/download — list all jobs in the queue. */
export const GET = withErrorHandling(async () => {
  return ok({ jobs: queueManager.list() });
});

/** POST /api/download — enqueue a new download. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as DownloadRequest | null;
  if (!body || !isValidUrl(body.url ?? "")) {
    return fail("A valid URL is required to start a download.", 400, { code: "INVALID_URL" });
  }
  if (!["video", "audio", "subtitles", "playlist"].includes(body.type)) {
    return fail("Unknown download type.", 400);
  }
  const id = await queueManager.enqueue(body);
  return ok({ jobId: id }, { status: 202 });
});

/** DELETE /api/download?id=... — cancel a job. */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Missing job id.", 400);
  const canceled = queueManager.cancel(id);
  if (!canceled) return fail("Job not found.", 404);
  return ok({ canceled: true });
});

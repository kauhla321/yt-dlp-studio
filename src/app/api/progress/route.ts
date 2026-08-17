import { progressBus } from "@/lib/progress/emitter";
import { queueManager } from "@/lib/queue/manager";
import type { ProgressSnapshot } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of progress for every job. The client opens one
 * EventSource and demultiplexes snapshots by jobId. Snapshots survive browser
 * refresh because the queue manager replays the latest state on connect.
 */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let onProgress: ((snap: ProgressSnapshot) => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller already closed; ignore
        }
      };
      const sendSnap = (snap: ProgressSnapshot) =>
        send(`data: ${JSON.stringify(snap)}\n\n`);

      // Replay current state so a freshly loaded page reflects ongoing jobs.
      for (const job of queueManager.list()) {
        sendSnap({ ...job.progress, status: job.status });
      }

      onProgress = (snap) => sendSnap(snap);
      progressBus.on("progress", onProgress);

      // Heartbeat keeps intermediaries from closing an idle connection.
      heartbeat = setInterval(() => send(": ping\n\n"), 15_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (onProgress) progressBus.off("progress", onProgress);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { NextResponse } from "next/server";
import { YtDlpError } from "@/lib/ytdlp/errors";
import type { ApiError } from "@/types";

/** JSON success response. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** JSON error response with a consistent envelope. */
export function fail(
  message: string,
  status = 400,
  extra: Partial<ApiError> = {}
): NextResponse {
  const body: ApiError = { error: message, ...extra };
  return NextResponse.json(body, { status });
}

/**
 * Error-handling middleware for route handlers. Wrap an async handler and
 * any thrown error becomes a well-formed ApiError with an appropriate status.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof YtDlpError) {
        const status = err.code === "YTDLP_MISSING" || err.code === "FFMPEG_MISSING" ? 503 : 422;
        return fail(err.message, status, { code: err.code, hint: err.hint });
      }
      const message = err instanceof Error ? err.message : "Unexpected server error.";
      console.error("[api] unhandled error:", err);
      return fail(message, 500, { code: "INTERNAL" });
    }
  };
}

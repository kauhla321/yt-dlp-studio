import { NextRequest } from "next/server";
import { analyzeUrl } from "@/lib/ytdlp/analyze";
import { isValidUrl } from "@/lib/utils/sanitize";
import { ok, fail, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
// yt-dlp metadata extraction can take a while for large playlists.
export const maxDuration = 120;

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    cookieMode?: boolean;
  };
  const url = body.url?.trim() ?? "";

  if (!isValidUrl(url)) {
    return fail("Please enter a valid http(s) URL.", 400, { code: "INVALID_URL" });
  }

  const result = await analyzeUrl(url, !!body.cookieMode);
  return ok(result);
});

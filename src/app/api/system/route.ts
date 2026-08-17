import { getSystemStatus } from "@/lib/ytdlp/system";
import { ok, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const status = await getSystemStatus();
  return ok(status);
});

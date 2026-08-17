import { getHistory, clearHistory } from "@/lib/store/history";
import { ok, withErrorHandling } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const entries = await getHistory();
  return ok({ entries });
});

export const DELETE = withErrorHandling(async () => {
  await clearHistory();
  return ok({ cleared: true });
});

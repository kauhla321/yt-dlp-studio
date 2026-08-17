import { NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/store/settings";
import { ok, withErrorHandling } from "@/lib/api/respond";
import type { AppSettings } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const settings = await getSettings();
  return ok(settings);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const patch = (await req.json().catch(() => ({}))) as Partial<AppSettings>;
  const settings = await saveSettings(patch);
  return ok(settings);
});

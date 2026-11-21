"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/primitives";
import { DISCLAIMER_PARAGRAPHS, DISCLAIMER_TITLE } from "@/lib/legal";

/**
 * First-launch usage notice. Covers the whole app until the user accepts it;
 * the acceptance time is stored in settings.json so it is asked only once.
 * If settings can't be read, it stays out of the way rather than locking the
 * app.
 */
export function DisclaimerGate() {
  const [needed, setNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settings()
      .then((s) => setNeeded(!s.disclaimerAcceptedAt))
      .catch(() => {});
  }, []);

  if (!needed) return null;

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveSettings({ disclaimerAcceptedAt: Date.now() });
      setNeeded(false);
    } catch (err) {
      setError((err as Error).message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
    >
      <div className="flex max-h-full w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-card border border-[#2b2b2b] bg-surface p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-ink-faint" aria-hidden="true">
            &gt;_
          </span>
          <h2 id="disclaimer-title" className="text-lg font-semibold">
            {DISCLAIMER_TITLE}
          </h2>
        </div>
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink-muted">
          {DISCLAIMER_PARAGRAPHS.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        {error && <p className="text-xs text-danger-text">{error}</p>}
        <Button size="lg" className="w-full" loading={saving} onClick={accept}>
          i understand and agree
        </Button>
      </div>
    </div>
  );
}

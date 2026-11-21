"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderIcon } from "./ui/icons";
import { canPickFolder, pickFolder } from "@/lib/desktop";

/**
 * "save to" row on the Download screen: shows where this download will land
 * and lets the user pick another folder with the native dialog. The choice is
 * saved as the new default for that kind of download (onChange persists it).
 */
export function SaveLocation({
  dir,
  label,
  onChange,
}: {
  dir: string;
  label: string;
  onChange: (dir: string) => Promise<void>;
}) {
  // Read the bridge after mount so SSR and the first client render agree.
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNative(canPickFolder()), []);

  const change = async () => {
    setError(null);
    const picked = await pickFolder(dir);
    if (!picked || picked === dir) return;
    setBusy(true);
    try {
      await onChange(picked);
    } catch (err) {
      setError((err as Error).message || "Could not save that folder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 rounded-control bg-surface py-2 pl-3.5 pr-2">
        <FolderIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] text-ink-faint">{label}</span>
          <span className="truncate text-xs text-ink" title={dir}>
            {dir || "…"}
          </span>
        </div>
        {native ? (
          <button
            type="button"
            onClick={change}
            disabled={busy}
            className="h-8 shrink-0 cursor-pointer rounded-[8px] bg-raised px-3 text-xs text-ink transition-colors duration-150 hover:bg-[#262626] disabled:cursor-default disabled:opacity-60"
          >
            {busy ? "saving…" : "change folder"}
          </button>
        ) : (
          <Link
            href="/settings"
            className="shrink-0 rounded-[8px] bg-raised px-3 py-2 text-xs text-ink no-underline"
          >
            change in settings
          </Link>
        )}
      </div>
      {error && <p className="px-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}

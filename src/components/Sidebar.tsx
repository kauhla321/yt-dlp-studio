"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui/primitives";
import { useTools } from "./hooks/useTools";
import { api } from "@/lib/client";
import { DownloadIcon, HistoryIcon, SettingsIcon, LoaderIcon } from "./ui/icons";

const NAV = [
  { href: "/", label: "download", icon: DownloadIcon },
  { href: "/downloads", label: "library", icon: HistoryIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { system, installs, installing } = useTools();
  const [hasInterrupted, setHasInterrupted] = useState(false);

  // Light poll so a playlist interrupted from another tab/session still
  // surfaces the amber dot here without a full navigation.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api
        .playlists()
        .then((r) => {
          if (!cancelled) setHasInterrupted(r.playlists.some((p) => p.status === "interrupted"));
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const probed = system !== null;
  const ready = !!system && system.ytdlp.available && system.ffmpeg.available;
  const busy = probed && !ready && (installing !== null || Object.values(installs ?? {}).some((s) => s.state === "downloading" || s.state === "extracting"));

  return (
    <nav
      aria-label="Primary"
      className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 bg-rail px-2 pb-3 pt-2.5"
    >
      <div className="flex h-9 items-center text-xl font-bold tracking-tighter text-white">&gt;_</div>

      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const showDot = href === "/downloads" && hasInterrupted;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-[58px] w-[72px] flex-col items-center justify-center gap-[5px] rounded-control text-[11px] font-medium no-underline transition-colors duration-150",
              active ? "bg-ink text-black" : "text-ink hover:bg-white/5"
            )}
          >
            {showDot && (
              <span className="absolute right-[18px] top-2 h-[7px] w-[7px] rounded-full bg-video" />
            )}
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}

      <div className="flex-1" />

      <Link
        href="/settings"
        aria-current={pathname.startsWith("/settings") ? "page" : undefined}
        className={cn(
          "flex h-[58px] w-[72px] flex-col items-center justify-center gap-[5px] rounded-control text-[11px] font-medium no-underline transition-colors duration-150",
          pathname.startsWith("/settings") ? "bg-ink text-black" : "text-ink hover:bg-white/5"
        )}
      >
        <SettingsIcon className="h-[18px] w-[18px]" />
        settings
      </Link>

      <Link
        href="/settings"
        title={!probed ? "checking tools…" : ready ? "tools ok" : "setup required"}
        className={cn(
          "flex h-[58px] w-[72px] flex-col items-center justify-center gap-1.5 rounded-control text-[11px] font-medium no-underline transition-colors duration-150",
          !probed && "text-ink-faint hover:bg-white/5",
          probed && ready && "text-ink hover:bg-white/5",
          probed && !ready && "bg-[#2a2208] text-video"
        )}
      >
        {!probed ? (
          <span className="h-2.5 w-2.5 rounded-full border-2 border-[#5a5a5a]" />
        ) : busy ? (
          <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
        ) : ready ? (
          <span className="h-2.5 w-2.5 rounded-full bg-done shadow-[0_0_0_4px_rgba(95,211,141,0.15)]" />
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-video" />
        )}
        {!probed ? "checking" : busy ? "setup" : ready ? "tools ok" : "setup"}
      </Link>
    </nav>
  );
}

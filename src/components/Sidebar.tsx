"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui/primitives";
import { useTools } from "./hooks/useTools";
import {
  DownloadIcon,
  HistoryIcon,
  SettingsIcon,
  TerminalIcon,
  CheckIcon,
  AlertIcon,
  LoaderIcon,
} from "./ui/icons";

const NAV = [
  { href: "/", label: "Download", icon: DownloadIcon },
  { href: "/downloads", label: "Library", icon: HistoryIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { system, installs, installing } = useTools();

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-white/10 bg-panel/70 py-5 backdrop-blur-xl lg:w-[260px] lg:items-stretch lg:px-3">
      {/* Brand */}
      <div className="mb-6 flex items-center gap-3 px-1 lg:px-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-salmon text-canvas shadow-glow-salmon transition-transform duration-200 ease-spring hover:-translate-y-0.5 hover:rotate-3">
          <TerminalIcon className="h-5 w-5" />
        </span>
        <div className="hidden lg:block">
          <p className="text-base font-bold leading-tight text-ink">yt-dlp Studio</p>
          <p className="text-[11px] text-ink-muted">Expert-Tier Utility</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200 ease-smooth cursor-pointer",
                active
                  ? "bg-white/5 text-salmon"
                  : "text-ink-muted hover:bg-white/5 hover:text-ink"
              )}
              title={label}
            >
              {/* 3px salmon vertical bar marks the active item (Studio Precision). */}
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-salmon" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Ready status panel */}
      <SystemStatusPanel system={system} installs={installs} installing={installing} />
    </aside>
  );
}

function SystemStatusPanel({
  system,
  installs,
  installing,
}: {
  system: ReturnType<typeof useTools>["system"];
  installs: ReturnType<typeof useTools>["installs"];
  installing: ReturnType<typeof useTools>["installing"];
}) {
  // Until the first probe resolves, `system` is null — show a neutral
  // "checking" state rather than implying anything is missing.
  const probed = system !== null;
  const ytdlp = system?.ytdlp.available ?? false;
  const ffmpeg = system?.ffmpeg.available ?? false;
  const ready = ytdlp && ffmpeg;

  const busyFor = (tool: "ytdlp" | "ffmpeg"): boolean => {
    const st = installs?.[tool]?.state;
    return installing === tool || st === "downloading" || st === "extracting";
  };

  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider",
            !probed ? "text-ink-faint" : ready ? "text-accent" : "text-warn"
          )}
        >
          {!probed ? "Checking…" : ready ? "System Ready" : "Setup Required"}
        </span>
        {probed &&
          (ready ? (
            <CheckIcon className="h-3.5 w-3.5 text-accent" />
          ) : (
            <AlertIcon className="h-3.5 w-3.5 text-warn" />
          ))}
      </div>
      <StatusRow label="yt-dlp" ok={ytdlp} probed={probed} busy={busyFor("ytdlp")} />
      <StatusRow label="ffmpeg" ok={ffmpeg} probed={probed} busy={busyFor("ffmpeg")} />
      {probed && !ready && (
        <p className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-salmon">
          Install missing tools →
        </p>
      )}
    </>
  );

  // When something's missing, the whole panel becomes a shortcut to the
  // installer in Settings so the "download tools" flow is never a dead end.
  if (probed && !ready) {
    return (
      <Link
        href="/settings"
        title="Install yt-dlp / ffmpeg"
        className="mt-4 hidden rounded-xl border border-warn/30 bg-warn/5 p-4 transition-colors hover:bg-warn/10 lg:block"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="mt-4 hidden rounded-xl border border-white/5 bg-panel2/60 p-4 lg:block">
      {body}
    </div>
  );
}

function StatusRow({
  label,
  ok,
  probed,
  busy,
}: {
  label: string;
  ok: boolean;
  probed: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5 font-mono text-xs text-ink-muted">
      {!probed ? (
        <span className="h-4 w-4 shrink-0 rounded-full border border-ink-faint/40" />
      ) : busy ? (
        <LoaderIcon className="h-4 w-4 shrink-0 animate-spin text-warn" />
      ) : ok ? (
        <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
      ) : (
        <AlertIcon className="h-4 w-4 shrink-0 text-warn" />
      )}
      <span className="flex-1">{label}</span>
      <span
        className={
          !probed
            ? "text-ink-faint"
            : busy
              ? "text-warn"
              : ok
                ? "text-accent"
                : "text-warn"
        }
      >
        {!probed ? "…" : busy ? "installing…" : ok ? "OK" : "missing"}
      </span>
    </div>
  );
}

"use client";

import { OptionRow, SectionTitle } from "./ui/primitives";
import { VideoCamIcon, NoteIcon } from "./ui/icons";
import { sanitizeFolderName, hashId } from "@/lib/utils/sanitize";
import type { AudioFormat } from "@/types";

export type PlaylistMode =
  | { kind: "best" }
  | { kind: "audio"; format: Extract<AudioFormat, "mp3" | "wav"> };

const OPTIONS: { id: string; mode: PlaylistMode; label: string; cmd: string; video: boolean }[] = [
  { id: "best", mode: { kind: "best" }, label: "best quality", cmd: '-f "bv*+ba/b"', video: true },
  {
    id: "mp3",
    mode: { kind: "audio", format: "mp3" },
    label: "audio · mp3",
    cmd: "-x --audio-format mp3",
    video: false,
  },
  {
    id: "wav",
    mode: { kind: "audio", format: "wav" },
    label: "audio · wav",
    cmd: "-x --audio-format wav",
    video: false,
  },
];

function isSame(a: PlaylistMode, b: PlaylistMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "audio" && b.kind === "audio") return a.format === b.format;
  return true;
}

export function PlaylistPanel({
  count,
  mode,
  onChange,
  title,
  url,
  outputDir,
}: {
  count: number | undefined;
  mode: PlaylistMode;
  onChange: (m: PlaylistMode) => void;
  title: string;
  url: string;
  outputDir: string;
}) {
  const folder = sanitizeFolderName(title || "Playlist");
  const archive = `archives/${hashId(url)}.txt`;

  return (
    <section aria-label="playlist download" className="flex flex-col gap-2">
      <SectionTitle title="download every item as" hint={count != null ? `applies to all ${count}` : undefined} />

      <div className="flex flex-col gap-1 rounded-card bg-surface p-1.5" role="radiogroup" aria-label="Playlist download mode">
        {OPTIONS.map((o) => {
          const selected = isSame(mode, o.mode);
          return (
            <OptionRow key={o.id} selected={selected} onSelect={() => onChange(o.mode)} className="h-[54px]">
              <span className="flex w-full items-center gap-3">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    background: selected ? "#000000" : o.video ? "#3a2e0a" : "#2a1f45",
                    color: o.video ? "#ffcf56" : "#b18cff",
                  }}
                >
                  {o.video ? <VideoCamIcon className="h-3 w-3" /> : <NoteIcon className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-sm font-semibold">{o.label}</span>
                <span className={selected ? "text-xs text-black/70" : "text-xs text-ink-faint"}>{o.cmd}</span>
              </span>
            </OptionRow>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-control bg-[#0b0b0b] px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
        <span>
          <span className="text-ink">saves to</span> {outputDir}\{folder}\
        </span>
        <span>
          <span className="text-ink">files</span> %(playlist_index)03d - %(title)s [%(id)s].%(ext)s
        </span>
        <span>
          <span className="text-ink">flags</span> --yes-playlist --ignore-errors --download-archive {archive}
        </span>
      </div>
      <p className="px-1 text-xs leading-relaxed text-ink-faint">
        the archive records every finished item, so an interrupted run resumes from the library
        without repeating work — even after a restart.
      </p>
    </section>
  );
}

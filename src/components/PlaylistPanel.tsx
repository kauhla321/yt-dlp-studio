"use client";

import { OptionRow, SectionTitle } from "./ui/primitives";
import { ListVideoIcon, FilmIcon, MusicIcon } from "./ui/icons";
import type { AudioFormat } from "@/types";

export type PlaylistMode =
  | { kind: "best" }
  | { kind: "audio"; format: Extract<AudioFormat, "mp3" | "wav"> };

export function PlaylistPanel({
  count,
  mode,
  onChange,
}: {
  count: number | undefined;
  mode: PlaylistMode;
  onChange: (m: PlaylistMode) => void;
}) {
  return (
    <section className="panel animate-fade-in p-4 sm:p-5">
      <SectionTitle
        icon={<ListVideoIcon className="h-4 w-4" />}
        title="Playlist Download"
        hint={count != null ? `${count} items` : undefined}
      />

      <div className="grid gap-2">
        <OptionRow selected={mode.kind === "best"} onSelect={() => onChange({ kind: "best" })}>
          <div className="flex items-center gap-3">
            <FilmIcon className="h-4 w-4 text-ink-muted" />
            <div>
              <span className="text-sm font-medium text-ink">Best quality</span>
              <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                yt-dlp -f &quot;bv*+ba/b&quot;
              </p>
            </div>
          </div>
        </OptionRow>

        <OptionRow
          selected={mode.kind === "audio" && mode.format === "mp3"}
          onSelect={() => onChange({ kind: "audio", format: "mp3" })}
        >
          <div className="flex items-center gap-3">
            <MusicIcon className="h-4 w-4 text-ink-muted" />
            <div>
              <span className="text-sm font-medium text-ink">Audio only · MP3</span>
              <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                -x --audio-format mp3 (every item)
              </p>
            </div>
          </div>
        </OptionRow>

        <OptionRow
          selected={mode.kind === "audio" && mode.format === "wav"}
          onSelect={() => onChange({ kind: "audio", format: "wav" })}
        >
          <div className="flex items-center gap-3">
            <MusicIcon className="h-4 w-4 text-ink-muted" />
            <div>
              <span className="text-sm font-medium text-ink">Audio only · WAV</span>
              <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                -x --audio-format wav (every item)
              </p>
            </div>
          </div>
        </OptionRow>
      </div>

      <p className="mt-3 rounded-lg bg-panel2/50 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
        Saved into a folder named after the playlist. A download archive tracks
        completed items so an interrupted download resumes without repeating work.
      </p>
    </section>
  );
}

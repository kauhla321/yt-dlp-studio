"use client";

import { OptionRow, SectionTitle, Badge } from "./ui/primitives";
import { MusicIcon } from "./ui/icons";
import { formatBytes } from "@/lib/utils/format-bytes";
import type { AudioFormat } from "@/types";

const FORMATS: { value: AudioFormat; label: string; note: string }[] = [
  { value: "mp3", label: "MP3", note: "universal · lossy" },
  { value: "wav", label: "WAV", note: "uncompressed · lossless" },
  { value: "aac", label: "AAC", note: "efficient · lossy" },
];

export function AudioOptions({
  selected,
  onSelect,
  estimatedBytes,
}: {
  selected: AudioFormat | null;
  onSelect: (f: AudioFormat) => void;
  estimatedBytes: number | null;
}) {
  return (
    <section className="panel animate-fade-in p-4 sm:p-5">
      <SectionTitle
        icon={<MusicIcon className="h-4 w-4" />}
        title="Audio Only"
        hint="extracted with ffmpeg after download"
      />
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Audio format">
        {FORMATS.map((f) => (
          <OptionRow
            key={f.value}
            selected={selected === f.value}
            onSelect={() => onSelect(f.value)}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink">{f.label}</span>
                {f.value === "wav" && <Badge tone="info">large</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-ink-muted">{f.note}</p>
            </div>
          </OptionRow>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[11px] text-ink-faint">
        yt-dlp -x --audio-format {selected ?? "mp3"}
        {estimatedBytes ? ` · ~${formatBytes(estimatedBytes)} source audio` : ""}
      </p>
    </section>
  );
}

"use client";

import { OptionRow, SectionTitle } from "./ui/primitives";
import { formatBytes } from "@/lib/utils/format-bytes";
import type { AudioFormat } from "@/types";

const FORMATS: { value: AudioFormat; label: string; note: string }[] = [
  { value: "mp3", label: "mp3", note: "universal · lossy" },
  { value: "wav", label: "wav", note: "lossless · large" },
  { value: "aac", label: "aac", note: "efficient · lossy" },
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
    <section aria-label="audio format" className="flex flex-col gap-2">
      <SectionTitle title="audio format" hint="extracted with ffmpeg after download" />
      <div className="grid grid-cols-3 gap-1.5 rounded-card bg-surface p-1.5" role="radiogroup" aria-label="Audio format">
        {FORMATS.map((f) => (
          <OptionRow
            key={f.value}
            selected={selected === f.value}
            onSelect={() => onSelect(f.value)}
            className="h-auto py-3.5"
          >
            <span className="flex flex-col items-start gap-1.5">
              <span className="text-base font-bold">{f.label}</span>
              <span className={selected === f.value ? "text-xs text-black/70" : "text-xs text-ink-muted"}>
                {f.note}
              </span>
              <span className="text-xs">{estimatedBytes ? `~${formatBytes(estimatedBytes)}` : "—"} source audio</span>
            </span>
          </OptionRow>
        ))}
      </div>
    </section>
  );
}

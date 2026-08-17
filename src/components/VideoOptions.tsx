"use client";

import { OptionRow, SectionTitle, Badge } from "./ui/primitives";
import { FilmIcon } from "./ui/icons";
import { formatBytes } from "@/lib/utils/format-bytes";
import type { VideoQualityOption } from "@/types";

export function VideoOptions({
  qualities,
  selectedId,
  onSelect,
}: {
  qualities: VideoQualityOption[];
  selectedId: string | null;
  onSelect: (q: VideoQualityOption) => void;
}) {
  if (qualities.length === 0) return null;
  return (
    <section className="panel animate-fade-in p-4 sm:p-5">
      <SectionTitle
        icon={<FilmIcon className="h-4 w-4" />}
        title="Video Quality"
        hint="resolution + the file format it downloads as"
      />
      <div className="stagger grid gap-2" role="radiogroup" aria-label="Video quality">
        {qualities.map((q) => (
          <OptionRow
            key={q.id}
            selected={selectedId === q.id}
            onSelect={() => onSelect(q)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-14 font-mono text-sm font-semibold text-ink">
                  {q.label}
                </span>
                <Badge tone="success">{q.container.toUpperCase()}</Badge>
                <span className="text-xs text-ink-muted">
                  {q.height}p
                  {q.fps ? ` · ${Math.round(q.fps)}fps` : ""}
                </span>
              </div>
              <Badge tone="neutral">{formatBytes(q.estimatedBytes)}</Badge>
            </div>
          </OptionRow>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[11px] text-ink-faint">
        the highlighted format is exactly what gets saved (no mp4 auto-convert)
      </p>
    </section>
  );
}

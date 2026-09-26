"use client";

import { OptionRow, SectionTitle } from "./ui/primitives";
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
    <section aria-label="video quality" className="flex flex-col gap-2">
      <SectionTitle title="quality" hint="pinned by format id · merged into the container shown" />
      <div className="flex flex-col gap-1 rounded-card bg-surface p-1.5" role="radiogroup" aria-label="Video quality">
        {qualities.map((q) => {
          const selected = selectedId === q.id;
          return (
            <OptionRow key={q.id} selected={selected} onSelect={() => onSelect(q)} className="h-11 items-center">
              <span className="grid w-full grid-cols-[70px_64px_minmax(0,1fr)_80px] items-center gap-3">
                <span className="text-sm font-bold">{q.label}</span>
                <span
                  className="justify-self-start rounded-[6px] px-1.5 py-px text-[11px] font-semibold"
                  style={{
                    background: selected ? "#000000" : "#1f1f1f",
                    color: selected ? "#e1e1e1" : "#a0a0a0",
                  }}
                >
                  {q.container}
                </span>
                <span className={selected ? "text-black/70" : "text-ink-muted"}>
                  {q.height}p{q.fps ? ` · ${Math.round(q.fps)}fps` : ""} · id {q.formatSelector.split("+")[0]}
                </span>
                <span className="text-right">{formatBytes(q.estimatedBytes)}</span>
              </span>
            </OptionRow>
          );
        })}
      </div>
    </section>
  );
}

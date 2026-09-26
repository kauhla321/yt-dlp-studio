"use client";

import { SectionTitle, Switch, cn } from "./ui/primitives";
import type { SubtitleTrack } from "@/types";

export interface SubtitleConfig {
  langs: string[];
  includeAuto: boolean;
  convertToSrt: boolean;
  embed: boolean;
}

export function SubtitleOptions({
  tracks,
  config,
  onChange,
  embedOk,
}: {
  tracks: SubtitleTrack[];
  config: SubtitleConfig;
  onChange: (c: SubtitleConfig) => void;
  /** Embedding only makes sense when a video file is being produced. */
  embedOk: boolean;
}) {
  if (tracks.length === 0) {
    return (
      <section aria-label="subtitles" className="flex flex-col gap-2">
        <SectionTitle title="subtitles" />
        <div className="rounded-control bg-[#0b0b0b] px-3 py-2.5 text-xs text-ink-faint">
          no subtitles available for this video.
        </div>
      </section>
    );
  }

  const toggleLang = (code: string) => {
    const has = config.langs.includes(code);
    onChange({
      ...config,
      langs: has ? config.langs.filter((l) => l !== code) : [...config.langs, code],
    });
  };

  return (
    <section aria-label="subtitles" className="flex flex-col gap-2">
      <SectionTitle title="subtitles" hint="pick any" />
      <div className="flex flex-col gap-3 rounded-card bg-surface p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {tracks.map((t) => {
            const active = config.langs.includes(t.langCode);
            return (
              <button
                key={`${t.langCode}-${t.auto}`}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLang(t.langCode)}
                className={cn(
                  "h-[34px] cursor-pointer rounded-[9px] px-3 text-[13px] font-medium transition-colors duration-150",
                  active ? "bg-ink text-black" : "bg-[#1c1c1c] text-ink hover:bg-[#242424]"
                )}
                title={t.auto ? "Auto-generated captions" : "Human-authored subtitles"}
              >
                {t.langName}
                {t.auto && " (auto)"}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col">
          <div className="border-t border-raised">
            <Switch
              id="sub-auto"
              checked={config.includeAuto}
              onChange={(v) => onChange({ ...config, includeAuto: v })}
              label="include auto-generated captions"
              flag="--write-auto-subs"
            />
          </div>
          <div className="border-t border-raised">
            <Switch
              id="sub-srt"
              checked={config.convertToSrt}
              onChange={(v) => onChange({ ...config, convertToSrt: v })}
              label="export as separate .srt files"
              flag="--convert-subs srt"
            />
          </div>
          <div className="border-t border-raised">
            <Switch
              id="sub-embed"
              checked={config.embed}
              onChange={(v) => onChange({ ...config, embed: v })}
              label="embed subtitles into the video"
              flag="--embed-subs"
              disabled={!embedOk}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

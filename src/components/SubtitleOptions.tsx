"use client";

import { SectionTitle, Toggle, OptionRow, cn } from "./ui/primitives";
import { CaptionsIcon } from "./ui/icons";
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
  subtitlesOnly,
  onSubtitlesOnly,
  disabled,
}: {
  tracks: SubtitleTrack[];
  config: SubtitleConfig;
  onChange: (c: SubtitleConfig) => void;
  subtitlesOnly: boolean;
  onSubtitlesOnly: () => void;
  /** Disable embed/“only” when the primary artifact is audio. */
  disabled?: boolean;
}) {
  if (tracks.length === 0) {
    return (
      <section className="panel p-4 sm:p-5">
        <SectionTitle icon={<CaptionsIcon className="h-4 w-4" />} title="Subtitles" />
        <p className="text-sm text-ink-muted">No subtitles available for this video.</p>
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
    <section className="panel animate-fade-in p-4 sm:p-5">
      <SectionTitle
        icon={<CaptionsIcon className="h-4 w-4" />}
        title="Subtitles"
        hint={`${tracks.length} track${tracks.length === 1 ? "" : "s"} available`}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tracks.map((t) => {
          const active = config.langs.includes(t.langCode);
          return (
            <button
              key={`${t.langCode}-${t.auto}`}
              type="button"
              aria-pressed={active}
              onClick={() => toggleLang(t.langCode)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ease-spring hover:-translate-y-0.5 active:scale-95",
                active
                  ? "border-salmon/60 bg-salmon-soft text-salmon"
                  : "border-border bg-canvas/50 text-ink-muted hover:border-border/80 hover:text-ink"
              )}
              title={t.auto ? "Auto-generated captions" : "Human-authored subtitles"}
            >
              {t.langName}
              {t.auto && <span className="ml-1 text-[10px] text-ink-faint">(auto)</span>}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        <Toggle
          id="sub-auto"
          checked={config.includeAuto}
          onChange={(v) => onChange({ ...config, includeAuto: v })}
          label="Include auto-generated captions"
          description="--write-auto-subs"
        />
        <Toggle
          id="sub-srt"
          checked={config.convertToSrt}
          onChange={(v) => onChange({ ...config, convertToSrt: v })}
          label="Export as separate .srt files"
          description="--convert-subs srt"
        />
        <Toggle
          id="sub-embed"
          checked={config.embed}
          onChange={(v) => onChange({ ...config, embed: v })}
          label="Embed subtitles into the video"
          description="--embed-subs (applies to video downloads)"
        />
      </div>

      <div className="mt-3">
        <OptionRow selected={subtitlesOnly} onSelect={onSubtitlesOnly} disabled={disabled}>
          <div>
            <span className="text-sm font-medium text-ink">Download subtitles only</span>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
              --write-subs --skip-download
            </p>
          </div>
        </OptionRow>
      </div>
    </section>
  );
}

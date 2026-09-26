"use client";

import { useState } from "react";
import { Button } from "./ui/primitives";
import { formatBytes } from "@/lib/utils/format-bytes";
import type { AnalysisResult, AudioFormat, VideoQualityOption } from "@/types";
import type { SubtitleConfig } from "./SubtitleOptions";

export type PrimarySelection =
  | { type: "video"; quality: VideoQualityOption }
  | { type: "audio"; format: AudioFormat }
  | { type: "subtitles" };

/**
 * Mirrors the argument order in `src/lib/ytdlp/download.ts#buildDownloadArgs`
 * for display only. It can't import that module directly — it (via
 * `progress.ts`) pulls in `node:path`, which breaks a client bundle — so the
 * selection logic is intentionally duplicated here. Keep this in sync with
 * `buildDownloadArgs` if that function's argument order changes.
 */
function buildPreviewLines(
  primary: PrimarySelection,
  subConfig: SubtitleConfig,
  cookieMode: boolean,
  outputTemplate: string,
  webpageUrl: string
): { text: string; color: string; indent: boolean }[] {
  const lines: { text: string; color: string; indent: boolean }[] = [
    { text: "$ yt-dlp", color: "#ffffff", indent: false },
  ];
  const add = (text: string, color = "#a0a0a0") => lines.push({ text, color, indent: true });

  add("--newline --no-warnings --progress-template …", "#5a5a5a");
  add("-o \"" + outputTemplate + "\"");
  if (cookieMode) add("--cookies-from-browser firefox");
  add("--no-playlist");

  const subs = subConfig;
  const wantsSubs = primary.type === "subtitles" || subs.embed || subs.langs.length > 0;

  if (primary.type === "audio") {
    add(`-x --audio-format ${primary.format} --audio-quality 0`);
  } else if (primary.type === "subtitles") {
    add("--skip-download");
  } else {
    add(`-f "${primary.quality.formatSelector}"`);
    add(`--merge-output-format ${primary.quality.mergeFormat}`);
  }

  if (wantsSubs) {
    add(subs.langs.length > 0 ? `--sub-langs ${subs.langs.join(",")}` : "--sub-langs all");
    add("--write-subs");
    if (subs.includeAuto) add("--write-auto-subs");
    if (subs.convertToSrt) add("--convert-subs srt");
    if (subs.embed && primary.type !== "subtitles") add("--embed-subs");
  }

  lines.push({ text: webpageUrl, color: "#6cb6ff", indent: true });
  return lines;
}

function summarize(
  primary: PrimarySelection,
  subConfig: SubtitleConfig,
  outputDir: string
): { summary: string; est: string } {
  const n = subConfig.langs.length;
  const subsPart = n > 0 ? ` + ${n} subtitle track${n === 1 ? "" : "s"}` : "";
  if (primary.type === "video") {
    const embedded = n > 0 && subConfig.embed ? ", embedded" : "";
    return {
      summary: `${primary.quality.label} ${primary.quality.container} video${subsPart}${embedded}. → ${outputDir}`,
      est: formatBytes(primary.quality.estimatedBytes),
    };
  }
  if (primary.type === "audio") {
    return {
      summary: `${primary.format} audio${subsPart}. → ${outputDir}`,
      est: "",
    };
  }
  return {
    summary:
      n > 0
        ? `${n} subtitle track${n === 1 ? "" : "s"} only — no video or audio. → ${outputDir}`
        : "pick at least one subtitle track. → " + outputDir,
    est: "",
  };
}

export function ReadyCard({
  primary,
  subConfig,
  cookieMode,
  analysis,
  outputDir,
  starting,
  canDownload,
  onDownload,
}: {
  primary: PrimarySelection;
  subConfig: SubtitleConfig;
  cookieMode: boolean;
  analysis: AnalysisResult;
  outputDir: string;
  starting: boolean;
  canDownload: boolean;
  onDownload: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const outputTemplate = `${outputDir}\\%(title)s [%(id)s].%(ext)s`;
  const lines = buildPreviewLines(primary, subConfig, cookieMode, outputTemplate, analysis.metadata.webpageUrl);
  const { summary, est } = summarize(primary, subConfig, outputDir);
  const command = lines.map((l) => l.text).join(" ");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be unavailable in some embedded contexts; ignore.
    }
  };

  return (
    <section
      aria-label="ready"
      className="flex flex-col gap-3 rounded-card border border-[#2b2b2b] p-4"
    >
      <p className="text-sm leading-relaxed text-ink">
        {summary}
        {est && <span className="text-ink-faint"> · ~{est}</span>}
      </p>
      <div className="relative rounded-control bg-[#0b0b0b] p-3 pr-20 font-mono text-xs leading-relaxed">
        {lines.map((ln, i) => (
          <div
            key={i}
            className={ln.indent ? "pl-4 break-all" : "break-all"}
            style={{ color: ln.color }}
          >
            {ln.text}
          </div>
        ))}
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 h-7 cursor-pointer rounded-[8px] bg-raised px-2.5 text-xs text-ink"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <Button size="lg" className="w-full" disabled={!canDownload} loading={starting} onClick={onDownload}>
        download
      </Button>
    </section>
  );
}

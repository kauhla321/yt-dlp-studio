"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Switch, Segmented } from "@/components/ui/primitives";
import { GithubIcon, StarIcon } from "@/components/ui/icons";
import { ToolsSection } from "@/components/ToolsSection";
import type { AppSettings } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {});
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    setSaved(false);
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await api.saveSettings(settings);
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="mx-auto flex w-full max-w-[880px] flex-col items-center px-4 py-9">
        <div className="skeleton h-64 w-full max-w-[640px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col items-center px-4 py-9">
      <div className="flex w-full max-w-[640px] flex-col gap-2.5">
        <h1 className="mb-1 px-1 text-[22px] font-semibold">settings</h1>

        <div className="px-1 text-[13px] font-semibold">tools</div>
        <ToolsSection />

        <div className="mt-2 px-1 text-[13px] font-semibold">save to</div>
        <section aria-label="save to" className="flex flex-col gap-3.5 rounded-card bg-surface p-4">
          <DirField
            id="video-dir"
            label="single videos, audio & subtitles"
            value={settings.videoOutputDir}
            placeholder="D:\Downloads\Videos"
            onChange={(v) => update("videoOutputDir", v)}
          />
          <DirField
            id="playlist-dir"
            label="playlists (one subfolder each)"
            value={settings.playlistOutputDir}
            placeholder="D:\Downloads\Playlists"
            onChange={(v) => update("playlistOutputDir", v)}
          />
        </section>

        <div className="mt-2 px-1 text-[13px] font-semibold">behaviour</div>
        <section aria-label="behaviour" className="flex flex-col rounded-card bg-surface p-1.5">
          <div className="px-3">
            <Switch
              id="cookie-default"
              checked={settings.cookieModeDefault}
              onChange={(v) => update("cookieModeDefault", v)}
              label="cookies on by default"
              description="pre-selects cookies (firefox) on the download screen"
            />
          </div>
          <div className="flex flex-col gap-2.5 border-t border-raised p-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px]">downloads at once</span>
              <span className="text-[11.5px] text-ink-faint">how many run in parallel · default 2</span>
            </span>
            <Segmented
              ariaLabel="downloads at once"
              layout="grid"
              items={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n }))}
              value={settings.maxConcurrent}
              onChange={(v) => update("maxConcurrent", v)}
            />
          </div>
        </section>

        <div className="mt-1 flex items-center gap-3 px-1">
          <Button size="lg" onClick={save} loading={saving}>
            save settings
          </Button>
          {saved && <span className="text-[13px] text-done">saved.</span>}
          <span className="ml-auto text-[11.5px] text-ink-faint">
            folders are validated and created when a download starts
          </span>
        </div>

        <div className="mt-6 border-t border-raised pt-5">
          <div className="px-1 text-[13px] font-semibold">about</div>
          <section aria-label="about" className="mt-2.5 flex flex-col gap-3 rounded-card bg-surface p-4">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              yt-dlp studio is a desktop wrapper that gives{" "}
              <a
                href="https://github.com/yt-dlp/yt-dlp"
                target="_blank"
                rel="noreferrer"
                className="text-ink underline-offset-2 hover:underline"
              >
                yt-dlp
              </a>{" "}
              a native gui. it doesn&apos;t reimplement any downloading — it runs the real{" "}
              <span className="text-ink">yt-dlp</span> (and <span className="text-ink">ffmpeg</span> for
              audio and merging) as local processes and streams their progress into this window.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/kauhla321"
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-2 rounded-[9px] bg-raised px-3 py-2 text-[12.5px] text-ink no-underline transition-colors duration-150 hover:bg-[#262626]"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                github.com/kauhla321
              </a>
              <a
                href="https://github.com/kauhla321/yt-dlp-studio"
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-2 rounded-[9px] bg-ink px-3 py-2 text-[12.5px] font-medium text-black no-underline transition-colors duration-150 hover:bg-white"
              >
                <StarIcon className="h-3.5 w-3.5" />
                star the project on github
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DirField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
        spellCheck={false}
      />
    </div>
  );
}

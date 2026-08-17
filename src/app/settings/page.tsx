"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Toggle, SectionTitle } from "@/components/ui/primitives";
import { FolderIcon, FilmIcon, ListVideoIcon, CheckIcon, CookieIcon } from "@/components/ui/icons";
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
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-salmon">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Configure download locations and default behaviour.
        </p>
      </header>

      <div className="space-y-4">
        <ToolsSection />

        <section className="panel p-5">
          <SectionTitle
            icon={<FolderIcon className="h-4 w-4" />}
            title="Download Locations"
          />
          <div className="space-y-4">
            <DirField
              id="video-dir"
              icon={<FilmIcon className="h-4 w-4" />}
              label="Single video output folder"
              hint="All single video and audio downloads are saved here."
              value={settings.videoOutputDir}
              placeholder="D:\Downloads\Videos"
              onChange={(v) => update("videoOutputDir", v)}
            />
            <DirField
              id="playlist-dir"
              icon={<ListVideoIcon className="h-4 w-4" />}
              label="Playlist output folder"
              hint="Each playlist gets its own subfolder named after the playlist title."
              value={settings.playlistOutputDir}
              placeholder="D:\Downloads\Playlists"
              onChange={(v) => update("playlistOutputDir", v)}
            />
          </div>
        </section>

        <section className="panel p-5">
          <SectionTitle icon={<CookieIcon className="h-4 w-4" />} title="Behaviour" />
          <div className="space-y-3">
            <Toggle
              id="cookie-default"
              checked={settings.cookieModeDefault}
              onChange={(v) => update("cookieModeDefault", v)}
              label="Enable Cookie Mode by default"
              description="Pre-checks Cookie Mode on the download screen (Firefox)."
            />
            <div className="rounded-xl border border-border bg-canvas/50 px-4 py-3">
              <label htmlFor="concurrency" className="block text-sm font-medium text-ink">
                Max concurrent downloads
              </label>
              <p className="mb-2 text-xs text-ink-muted">
                How many downloads run at once (1–6).
              </p>
              <input
                id="concurrency"
                type="number"
                min={1}
                max={6}
                value={settings.maxConcurrent}
                onChange={(e) => update("maxConcurrent", Number(e.target.value))}
                className="input-field w-24"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving} icon={!saving && <CheckIcon className="h-4 w-4" />}>
            Save settings
          </Button>
          {saved && <span className="text-sm text-accent">Saved.</span>}
        </div>

        <p className="rounded-xl border border-border bg-panel2/40 px-4 py-3 text-xs text-ink-muted">
          Paths are validated and created automatically when a download starts. Folder
          names are sanitized for Windows, macOS, and Linux compatibility.
        </p>
      </div>
    </div>
  );
}

function DirField({
  id,
  icon,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="text-accent">{icon}</span>
        {label}
      </label>
      <p className="mb-2 mt-0.5 text-xs text-ink-muted">{hint}</p>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input-field font-mono"
        spellCheck={false}
      />
    </div>
  );
}

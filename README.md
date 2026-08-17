# yt-dlp Studio

A modern, desktop-style web GUI for [yt-dlp](https://github.com/yt-dlp/yt-dlp). Analyze any
video or playlist URL, then download video, audio, subtitles, or whole playlists with live
progress, configurable output folders, download history, and resumable playlist downloads.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS · Node.js**.

---

## Features

- **Analyze & Download** — paste a URL, detect single video vs. playlist, and see real options.
- **Video quality & format** — only the resolutions that actually exist (4K → 144p), listed per
  **(resolution, container)** so the same resolution can appear as e.g. `1080p · MP4` and
  `1080p · WEBM`, each with fps and estimated size. The chosen stream is pinned by its exact
  yt-dlp `format_id` and merged into the container shown, so the saved file is the format you
  picked — not auto-converted to mp4.
- **Audio extraction** — MP3 / WAV / AAC via `yt-dlp -x --audio-format …` (ffmpeg).
- **Subtitles** — pick languages, include auto-captions, export `.srt`, embed into video, or
  download subtitles only.
- **Playlists** — best quality (`bv*+ba/b`) or audio-only for every item, saved into a folder
  named after the playlist.
- **Cookie Mode** — `--cookies-from-browser firefox` for authenticated / age-restricted / private
  media, with Firefox detection and friendly errors.
- **Real-time progress** — status, speed, ETA, progress bar, and current file via Server-Sent Events.
- **Reliable cancel** — cancelling kills the whole yt-dlp/ffmpeg process tree (no orphaned
  downloads that keep running and then error out).
- **Retry & open** — failed downloads can be retried straight from the Library (the full
  request is remembered), and every history row or finished queue card can reveal the output
  folder in Explorer.
- **Copy the exact command** — finished jobs show (and copy) the precise `yt-dlp` command
  line that ran.
- **Fresh analysis** — returning to the Download screen silently re-analyzes the cached URL
  so formats are never stale.
- **Metadata** — thumbnail, title, uploader, duration, upload date, views, playlist size.
- **Download history** — title, URL, date, location, type, and status, persisted to disk.
- **Resume interrupted playlists** — uses `--download-archive` so a 1,000+ item playlist resumes
  without re-downloading completed videos. Survives browser refresh, app restart, and reboot.
- **Configurable locations** — separate default folders for single videos and playlists.
- **Polished desktop UI** — dark theme with a teal-green (system/status) + salmon-pink (actions)
  palette, springy interactions, staggered entrances, and animated section transitions. The
  Download screen keeps your URL and analysis when you visit Settings and come back.

---

## The tools: yt-dlp & ffmpeg

The app needs `yt-dlp` (everything) and `ffmpeg` (audio extraction & merging). You do **not**
have to install them yourself — the app resolves them in this order:

1. an explicit `YT_DLP_PATH` / `FFMPEG_PATH` env var,
2. **the folder the app lives in** (drop `yt-dlp.exe` / `ffmpeg.exe` next to the `.exe`), then its `bin/` subfolder,
3. your system `PATH`.

**Settings → Update** has a separate button per tool: **Install** when it's missing, **Update**
(re-download the latest) when it's already present. Either way the binary is saved **only into the
app's own folder** (the current working directory) — `yt-dlp.exe` from the official GitHub release
and `ffmpeg` from the GitHub-hosted BtbN build. The home-screen banner also offers Install when a
tool is missing. If the app folder isn't writable, you get a clear error asking you to move the app
somewhere writable (it never installs elsewhere). (Auto-install is Windows-only; on macOS/Linux
install the tools with your package manager.)

Firefox is optional, used only for **Cookie Mode**.

Environment overrides:

```bash
YT_DLP_PATH=/path/to/yt-dlp      # explicit binary location
FFMPEG_PATH=/path/to/ffmpeg
YTP_BIN_DIR=/folder/to/search    # where tools are looked up / installed (default: next to the exe)
YTP_DATA_DIR=/custom/state/dir   # history / settings / archives (default: app userData, or ./data in dev)
```

---

## Run it as a desktop app (Electron)

The app ships as a real native window — no browser, no `.bat`. Electron starts the bundled
Next.js server on a free local port and loads it inside the window.

**Develop with the desktop window:**

```bash
npm install
npm run electron:dev    # starts next dev + opens the Electron window
```

**Build a single, shareable portable `.exe`:**

```bash
npm run dist            # → release/yt-dlp-studio.exe
```

`yt-dlp-studio.exe` is self-contained — copy it anywhere and double-click. It looks for
yt-dlp/ffmpeg next to itself (or installs them via the in-app button), and stores history /
settings / playlist state in your per-user app-data folder so they survive moving the exe.

> To brand the window/exe, drop an `electron/icon.ico` before building; otherwise the default
> Electron icon is used.

---

## Run it as a plain web server (optional)

```bash
npm install
npm run dev          # http://localhost:3000  (open in a browser)
# or production:
npm run build && npm start
```

Type-check: `npm run typecheck` · Lint: `npm run lint` · Unit tests: `npm test`.

---

## Architecture

```
electron/main.js                Desktop shell: runs the Next server, opens the window
scripts/prepare-standalone.mjs  Post-build: copy static/public into .next/standalone
src/
├── app/
│   ├── layout.tsx              App shell (sidebar + fonts); persists across navigation
│   ├── template.tsx            Per-route wrapper → section-switch entrance animation
│   ├── page.tsx                Main download interface (state persisted to sessionStorage)
│   ├── downloads/page.tsx      Library: history + resume
│   ├── settings/page.tsx       Update (install/update tools), output folders, behaviour
│   └── api/
│       ├── analyze/route.ts    POST  → yt-dlp metadata + formats
│       ├── download/route.ts   POST enqueue · GET list · DELETE cancel
│       ├── progress/route.ts   GET   → Server-Sent Events stream
│       ├── history/route.ts    GET / DELETE
│       ├── playlists/route.ts  GET states · POST resume
│       ├── settings/route.ts   GET / POST
│       ├── system/route.ts     GET   → yt-dlp / ffmpeg / Firefox status
│       ├── tools/route.ts      GET status · POST install yt-dlp/ffmpeg
│       └── open/route.ts       POST  → reveal a path in Explorer (Windows)
├── components/                 React UI (panels, queue, progress, icons, tools)
├── lib/
│   ├── ytdlp/                  Service layer: exec, analyze, formats, download, progress, errors, system
│   ├── tools/                  Binary resolver (paths) + in-app installer
│   ├── queue/manager.ts        Download queue manager (singleton, concurrency)
│   ├── progress/emitter.ts     Process-wide progress event bus (SSE source)
│   ├── store/                  Disk persistence: settings, history, playlist-state
│   └── utils/                  sanitize, byte/duration formatting
└── types/index.ts              Shared domain types
```

`src/middleware.ts` rejects any request whose Host header isn't a loopback address
(DNS-rebinding guard for the local API).

### How progress works

`yt-dlp` is spawned with `--newline` and a machine-readable `--progress-template`. The queue
manager parses each line, blends per-item and playlist-index progress, and publishes snapshots to
a process-wide event bus. The `/api/progress` route streams those snapshots over SSE; the client
opens a single `EventSource` and demultiplexes by job id. Current state is replayed on connect, so
progress is correct after a browser refresh.

### How resume works

Playlist downloads pass `--download-archive data/archives/<id>.txt`. Every completed video is
recorded there. Playlist state (`data/playlists.json`) is written before the download starts and
updated as items finish. On startup, any playlist still marked `downloading` is reconciled to
`interrupted`. Resuming re-runs yt-dlp with the same archive file, so completed items are skipped
and only the remainder is fetched — even across reboots, for arbitrarily large playlists.

All runtime state (`settings.json`, `history.json`, `playlists.json`, `archives/`) lives under
`./data` (override with `YTP_DATA_DIR`) and is written atomically.

---

## Building the portable .exe: Windows symlink note

`electron-builder` downloads a `winCodeSign` helper whose archive contains macOS symlinks.
Extracting those on Windows needs the *Create symbolic links* privilege, so on a default install
`npm run dist` can fail with:

```
ERROR: Cannot create symbolic link ... A required privilege is not held by the client.
```

Fix it once, with either:

- **Enable Developer Mode** — Settings → Privacy & security → For developers → *Developer Mode* On, **or**
- **Run the build in an elevated (Administrator) terminal.**

Then `npm run dist` completes and writes `release/yt-dlp-studio.exe`. (This is an
electron-builder/Windows quirk, unrelated to the app code.)

---

## Notes & limitations

- **Cookie Mode** reads cookies from your local Firefox profile. Close Firefox while downloading
  (the database can be locked while the browser is running).
- This is a **local** tool: it spawns processes and writes files on the host. Do not expose it to
  untrusted networks without adding authentication and input hardening.
- The local API only accepts loopback `Host` headers and serves a restrictive
  Content-Security-Policy, so a malicious webpage cannot drive it via DNS rebinding.
- Respect the terms of service of the sites you download from and applicable copyright law.

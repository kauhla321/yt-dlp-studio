# yt-dlp Studio — Architecture

In-depth technical documentation for the `yt-dlpinterface` codebase (product name:
**yt-dlp Studio**, package name `yt-dlp-studio`).

This document describes how the system is built, how it runs, how data flows
through it, and the reasoning behind its design. It complements the README,
which covers user-facing features and usage.

---

## 1. Overview

yt-dlp Studio is a **local desktop GUI for [yt-dlp](https://github.com/yt-dlp/yt-dlp)**
that ships as a portable Windows executable. It lets a user paste a video or
playlist URL, inspect real metadata and formats, and download video, audio,
subtitles, or whole playlists — with live progress, download history, and
resumable playlists.

At its core it is a **Next.js 14 web application** (server + browser UI, all
running locally on `127.0.0.1`) wrapped in an **Electron shell** that provides
the native window. All heavy lifting is done by spawning the real `yt-dlp`
(and `ffmpeg`) binaries as child processes from the Next.js server — no
bundled libraries or API integrations, just the actual CLI tools.

```
┌─────────────────────────────────────────────────────────────┐
│  Electron main process (electron/main.js)                   │
│  • opens the window, spawns the Next server, manages boot   │
└──────────────────────────┬──────────────────────────────────┘
                           │ spawn (ELECTRON_RUN_AS_NODE=1)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js standalone server  (127.0.0.1:<free port>)         │
│  • API routes  • queue manager  • stores  • progress bus   │
│  • spawns yt-dlp / ffmpeg / taskkill as child processes    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP + SSE (fetch / EventSource)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BrowserWindow (Electron, contextIsolation on)             │
│  • React UI: Download / Library / Settings screens          │
│  • one EventSource for live progress snapshots              │
└─────────────────────────────────────────────────────────────┘
```

There are exactly **three runtime processes** in a packaged install:

1. `yt-dlp-studio.exe` — Electron main (window + server lifecycle)
2. the Node server (`server.js` running under Electron's Node runtime)
3. one `yt-dlp.exe` per active download (plus transient `ffmpeg`/`taskkill` children)

The UI never talks to yt-dlp directly; every interaction goes through the
server's HTTP API.

---

## 2. Technology stack

| Concern | Choice |
|---|---|
| Web framework | Next.js 15.5 (App Router, route handlers, `output: "standalone"`) |
| UI | React 18.3, TypeScript 5.9, Tailwind CSS 3.4 |
| Desktop shell | Electron 43 (main process spawns the server) |
| Packaging | electron-builder 26 (`--win portable` → single `.exe`) |
| Testing / lint | Vitest 4 (unit) · ESLint 9 + neostandard (flat config) |
| Download engine | real `yt-dlp` binary + `ffmpeg` (spawned via `node:child_process`) |
| Zip extraction (installer) | `yauzl` (streaming, lazy entries) |
| Persistence | plain JSON files on disk (atomic write via temp + rename) |
| Real-time progress | Server-Sent Events (no WebSocket dependency) |
| Runtime | Node ≥ 18.18 (browser-fetch in Node for tool downloads) |

Dependencies are deliberately minimal: `next`, `react`, `react-dom`, `yauzl`
(runtime) and dev-only tooling. There is no database, no state library, no
UI kit — the app is hand-rolled throughout.

---

## 3. Directory map

```
yt-dlpinterface/
├── electron/
│   └── main.js                    Electron main process (window + server boot)
├── scripts/
│   └── prepare-standalone.mjs     post-build: copy static/public into standalone
├── src/
│   ├── app/
│   │   ├── layout.tsx             root layout: fonts, sidebar, scroll shell
│   │   ├── template.tsx           per-navigation wrapper (entrance animation)
│   │   ├── globals.css            design-system CSS (Tailwind layers)
│   │   ├── page.tsx               Download screen (main flow + queue)
│   │   ├── downloads/page.tsx     Library: history + resume playlists
│   │   ├── settings/page.tsx      Settings: folders, behaviour, tools
│   │   └── api/                   all HTTP endpoints (route handlers)
│   │       ├── analyze/route.ts
│   │       ├── download/route.ts
│   │       ├── progress/route.ts  SSE stream
│   │       ├── history/route.ts
│   │       ├── playlists/route.ts
│   │       ├── settings/route.ts
│   │       ├── system/route.ts
│   │       └── tools/route.ts
│   ├── components/
│   │   ├── Sidebar.tsx            nav + live system-status panel
│   │   ├── SystemBanner.tsx       missing-tool banner with install buttons
│   │   ├── MetadataCard.tsx       analyzed-media info card
│   │   ├── VideoOptions.tsx       quality list (resolution × container)
│   │   ├── AudioOptions.tsx       mp3 / wav / aac picker
│   │   ├── SubtitleOptions.tsx    language chips + srt/embed toggles
│   │   ├── PlaylistPanel.tsx      best-quality / audio-only modes
│   │   ├── DownloadQueue.tsx      live job cards
│   │   ├── ProgressBar.tsx        status-colored progress bar
│   │   ├── ToolsSection.tsx       settings-page tool installer
│   │   ├── hooks/
│   │   │   ├── useProgress.ts     global SSE subscription (per-job map)
│   │   │   └── useTools.ts        thin wrapper over the tool status store (see §5.8)
│   │   └── ui/
│   │       ├── primitives.tsx     Button, Toggle, Badge, OptionRow, SectionTitle, cn
│   │       └── icons.tsx          inline Lucide-style SVG icons
│   ├── lib/
│   │   ├── api/respond.ts         ok() / fail() / withErrorHandling()
│   │   ├── client.ts              typed browser-side fetch wrapper
│   │   ├── ytdlp/                 service layer (see §5.4)
│   │   │   ├── exec.ts            spawn helpers, process-tree kill
│   │   │   ├── analyze.ts         URL analysis (yt-dlp -J)
│   │   │   ├── formats.ts         quality/subtitle parsing from raw formats
│   │   │   ├── download.ts        DownloadRequest → yt-dlp argv
│   │   │   ├── progress.ts        sentinel progress parsing + blending
│   │   │   ├── errors.ts          typed error classification
│   │   │   └── system.ts          environment probe (tools + Firefox)
│   │   ├── tools/
│   │   │   ├── paths.ts           binary resolution & install locations
│   │   │   ├── installer.ts       in-app download/install of yt-dlp & ffmpeg
│   │   │   ├── status-store.ts    shared client store: probe + install polling (see §5.8)
│   │   │   └── status-store.test.ts  unit tests for the store state machine
│   │   ├── queue/manager.ts       download queue (singleton, concurrency)
│   │   ├── progress/emitter.ts    process-wide progress event bus
│   │   ├── store/                 disk persistence
│   │   │   ├── json-store.ts      atomic JSON read/write, DATA_DIR
│   │   │   ├── settings.ts
│   │   │   ├── history.ts
│   │   │   └── playlist-state.ts
│   │   └── utils/
│   │       ├── sanitize.ts        folder-name sanitizing, URL check, hashId
│   │       └── format-bytes.ts    bytes / duration / count / date formatting
│   └── types/index.ts             shared domain contract (server ↔ client)
├── data/                          dev-mode runtime state (see §5.7)
│   ├── settings.json
│   ├── history.json
│   ├── playlists.json
│   └── archives/<hash>.txt        yt-dlp --download-archive files
├── release/                       electron-builder output (built exe)
├── UI REQUIRMENT/                 design specs & mockups (product brief, DESIGN.md)
├── next.config.js                 standalone output, remote images
├── tailwind.config.ts             "Studio Precision" design tokens
└── package.json                   scripts, dependencies, electron-builder config
```

---

## 4. Runtime topology

### 4.1 Packaged (production) boot sequence

1. User launches `yt-dlp-studio.exe` (electron-builder **portable** target).
2. `electron/main.js` acquires the single-instance lock (`app.requestSingleInstanceLock()`);
   a second launch focuses the existing window instead.
3. `createWindow()` opens a `BrowserWindow` (1200×820, min 880×600,
   `contextIsolation: true`, `nodeIntegration: false`, dark background), shows
   an inline **splash page** (`data:` URL with a spinner), and denies all
   `window.open` calls, routing external links to the system browser instead.
4. `boot()` picks a **free localhost port** (`net.listen(0)` — dev uses fixed
   port 3000) and spawns the bundled server:

   ```
   electron.exe .next/standalone/server.js
   env: ELECTRON_RUN_AS_NODE=1   ← the Electron binary acts as plain Node
        NODE_ENV=production, PORT=<free>, HOSTNAME=127.0.0.1
        NEXT_TELEMETRY_DISABLED=1
        YTP_DATA_DIR=<Electron userData>   ← per-user state
        YTP_BIN_DIR=<folder of the .exe>   ← tool lookup / install target
   ```

5. `waitForServer()` polls `http://127.0.0.1:<port>` every 100 ms (up to 30 s)
   and swaps the window from splash to the app URL as soon as it responds.
6. If the server dies unexpectedly (non-zero exit while not quitting), the
   window switches to a red **error page** with the exit code instead of a
   blank screen.
7. `before-quit` kills the server child process; `window-all-closed` quits.

The environment plumbing is what makes the portable app self-contained:
state goes to the per-user Electron `userData` directory (so moving the exe
doesn't lose settings/history), and binaries are found/installed **next to the
exe** (see §5.8).

### 4.2 Development

`npm run electron:dev` runs `next dev` (port 3000) and Electron concurrently.
In dev, `app.isPackaged` is false, so the Electron shell skips spawning a
server and simply loads `http://127.0.0.1:3000`.

You can also run the web app alone in a browser (`npm run dev`) — everything
works the same; the Electron layer only adds the window.

---

## 5. Architectural layers

### 5.1 Shared types — the contract (`src/types/index.ts`)

One file defines the entire API contract shared by the service layer, the
route handlers, and the React frontend. Highlights:

- **Domain enums**: `MediaKind` (`video`/`playlist`), `QualityLabel`
  (4K→144p), `AudioFormat` (`mp3`/`wav`/`aac`), `DownloadType`
  (`video`/`audio`/`subtitles`/`playlist`), `JobStatus`
  (`queued|downloading|processing|completed|failed|interrupted|canceled`).
- **Analysis**: `AnalysisResult` = `MediaMetadata` + `VideoQualityOption[]`
  + `audioAvailable` + `audioEstimatedBytes` + `SubtitleTrack[]`.
- **Requests**: `DownloadRequest` — one shape that covers every job kind
  (format selector, merge format, audio format, subtitle config, cookie mode,
  output dir override).
- **Live state**: `ProgressSnapshot` (jobId, status, percent, currentFile,
  speed, eta, playlist index/total, message, error) — the unit streamed over SSE.
- **Persistence**: `HistoryEntry`, `PlaylistState` (resume metadata).
- **Settings**: `AppSettings` (`videoOutputDir`, `playlistOutputDir`,
  `cookieModeDefault`, `maxConcurrent`).
- **System/tools**: `SystemStatus`, `ToolInstallStatus`.
- **Error envelope**: `ApiError` `{ error, code?, hint? }` with the
  `isApiError()` type guard — every non-2xx response and every thrown error
  carries a user-readable message and an optional remediation hint.

### 5.2 HTTP API layer (`src/app/api/*`, `src/lib/api/respond.ts`)

All routes are Next.js **route handlers**, exported as `force-dynamic`
(no caching; the app is a local server, and every request must see fresh
process/disk state).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analyze` | POST | Analyze a URL: metadata, qualities, subtitles (`maxDuration: 120`) |
| `/api/download` | GET | List all queue jobs (in-memory, newest first) |
| `/api/download` | POST | Enqueue a download → `202 { jobId }` |
| `/api/download?id=` | DELETE | Cancel a job (kills process tree) |
| `/api/progress` | GET | SSE stream of `ProgressSnapshot`s for all jobs |
| `/api/history` | GET / DELETE | Download history |
| `/api/playlists` | GET | Saved playlist states (for resume UI); boots reconciliation |
| `/api/playlists` | POST | Resume an interrupted playlist → `202 { jobId }` |
| `/api/settings` | GET / POST | Read / patch settings |
| `/api/system` | GET | Probe yt-dlp, ffmpeg, Firefox status |
| `/api/open` | POST | Reveal a folder or file in Explorer (Windows) |
| `/api/tools` | GET | System probe + per-tool install state |
| `/api/tools` | POST | Start an install (`{ tool: "ytdlp" | "ffmpeg" }`) → `202` |

**Response envelope & error handling** (`respond.ts`):

- `ok(data)` → `200 JSON`; `fail(message, status, {code, hint})` → error JSON.
- `withErrorHandling(handler)` wraps every route: a thrown `YtDlpError`
  becomes a typed error response — `503` when a tool binary is missing,
  `422` for other classified failures — and anything else becomes
  `500 { code: "INTERNAL" }`. Route handlers stay tiny because all logic
  lives in the service layer.

### 5.3 Browser client (`src/lib/client.ts`)

A thin typed wrapper over `fetch` used by every page/component:

- all calls go through one `request<T>()` helper that parses JSON, detects
  the `ApiError` envelope, and throws an `Error` carrying the server's
  friendly `message`, plus `err.hint` and `err.code` for the UI to render.
- exposes `api.system / tools / installTool / analyze / download / jobs /
  cancel / history / clearHistory / playlists / resumePlaylist /
  settings / saveSettings`.

The client does **no** business logic — it serializes UI state to
`DownloadRequest` and renders what the server returns.

### 5.4 yt-dlp service layer (`src/lib/ytdlp/`)

The heart of the app: everything yt-dlp-related lives here, isolated from
HTTP and UI.

#### `exec.ts` — process management

- `runCollect(command, args, {timeoutMs})` — spawn and capture all stdout/stderr
  until exit; used for short-lived commands (analyze, version probes).
- `runStream(command, args, handlers)` — spawn a long-running process and
  invoke callbacks **line by line** on stdout/stderr; used for downloads.
  The line splitter handles both `\n` and `\r` because yt-dlp uses
  carriage returns for in-place progress updates.
- `killProcessTree(child)` — the critical cancel primitive. `child.kill()`
  alone only kills the direct process; on Windows, `yt-dlp.exe` is a
  PyInstaller bundle that spawns `ffmpeg` as children, so cancellation runs
  `taskkill /pid <pid> /t /f` to walk the **whole tree**. Non-Windows falls
  back to `SIGKILL`.
- `taggedSpawnError()` wraps `ENOENT` so the error classifier can report
  "Executable not found" precisely.

#### `analyze.ts` — URL analysis

One yt-dlp call per analysis (60 s timeout):

```
yt-dlp -J --flat-playlist --no-warnings --no-progress [--cookies-from-browser firefox] <url>
```

- `-J` dumps full JSON metadata; `--flat-playlist` keeps playlist analysis
  fast (entries are not individually extracted) while single videos still get
  complete format lists.
- Playlists are detected via `_type === "playlist"` / `entries` array. For a
  playlist, the result carries only metadata + item count (+ thumbnail
  borrowed from the first entry) — format detail is deliberately skipped.
- For a video, the raw `formats[]` array is reduced by `formats.ts` into
  selectable options, plus `audioAvailable`, `audioEstimatedBytes`, and the
  subtitle list.
- Upload date is converted `YYYYMMDD → YYYY-MM-DD`; thumbnail prefers
  `thumbnail`, falling back to the last `thumbnails[]` entry.

#### `formats.ts` — quality model

- Raw formats are bucketed into discrete quality labels (4K/2K/1080p/…/144p
  by `height` thresholds).
- **One option per (resolution, container) that actually exists** — the same
  resolution can appear as both `1080p · MP4` and `1080p · WEBM`. Within a
  group the highest-bitrate stream wins.
- Options are sorted resolution-high→low, then by container preference
  (`mp4`, `webm`, `mkv`).
- Each option embeds a **format selector that pins the exact yt-dlp
  `format_id`** of the stream the user picked:

  ```
  <format_id>+bestaudio[ext=m4a]/bestaudio / <format_id> / best[height<=<bucket>]
  ```

  This is a deliberate design decision: the downloaded file is *exactly* the
  format shown in the UI (merged into the same container) — no surprise
  mp4 auto-conversion. Audio is matched to the container (`m4a` for mp4,
  `webm` for webm), with fallbacks.
- Estimated sizes: video `filesize`/`filesize_approx` + the best audio-only
  stream's size (chosen by `abr`/`tbr`).
- `parseSubtitles()` merges human subtitles and automatic captions into
  `SubtitleTrack`s (human first, then alphabetical), with a known-name map
  for common language codes.

#### `download.ts` — request → argv

`buildDownloadArgs(req, ctx)` translates a `DownloadRequest` into the exact
yt-dlp command line, mirroring the UI's option groups:

- base: `--newline --no-warnings --progress-template <TEMPLATE> -o <template>`
- cookie mode → `--cookies-from-browser firefox`
- playlist → `--yes-playlist --ignore-errors` + `--download-archive <path>`
- single video → `--no-playlist`
- `type: video` → `-f <selector> --merge-output-format <container>`
- `type: audio` → `-x --audio-format <fmt> --audio-quality 0`
- `type: subtitles` → `--skip-download` + forced subtitle args
- subtitle args (when requested): `--sub-langs`, `--write-subs`,
  `--write-auto-subs`, `--convert-subs srt`, `--embed-subs` (media only)

#### `progress.ts` — machine-readable progress

yt-dlp's normal output is a wall of control characters. Instead of parsing it,
the app hands yt-dlp a custom **progress template**:

```
--progress-template "__YTP__\t%(progress.status)s\t%(progress._percent_str)s
   \t%(progress._speed_str)s\t%(progress._eta_str)s\t%(progress.filename)s"
```

With `--newline`, each update arrives as one line prefixed by the sentinel
`__YTP__` — deterministic, tab-separated parsing. `parseProgressLine()`
handles three line families:

1. **sentinel lines** → percent/speed/eta/currentFile; `finished` maps to
   `processing` at 100%.
2. **playlist progress** — `/Downloading item X of Y/` → `playlistIndex` /
   `playlistTotal` (used by the queue manager to update persisted state).
3. **post-processing** — `[ExtractAudio]`, `[Merger]`, `[EmbedSubtitle]`, etc.
   → status `processing`.

`overallPercent()` blends per-file percent into playlist position so the
overall bar advances smoothly across multi-item playlists:

```
base   = ((index-1) / total) * 100        # progress through items
within = percent / total                  # progress within current item
overall = min(100, base + within)
```

#### `errors.ts` — user-friendly failure classification

Raw yt-dlp stderr is regex-matched against a table to produce typed, friendly
errors with remediation hints: `PRIVATE_VIDEO`, `AGE_RESTRICTED`,
`UNAVAILABLE`, `NO_FORMATS`, `COOKIE_FAILURE`, `GEO_BLOCKED`,
`FFMPEG_MISSING`, `INVALID_URL`, `NETWORK`. Spawn `ENOENT` → `YTDLP_MISSING`.
Anything unmatched falls back to the last `ERROR:` line, or a generic
`UNKNOWN`.

#### `system.ts` — environment probe

- `yt-dlp --version` and `ffmpeg -version` (8 s timeouts) to report
  availability, version, resolved path, and **source** (`local` = env var or
  app folder, `path` = system PATH).
- Firefox detection reads `profiles.ini` from platform-appropriate locations
  (Windows: `%APPDATA%\Mozilla\Firefox`, macOS: `~/Library/Application
  Support/Firefox`, Linux: `~/.mozilla/firefox` + snap path) — used to
  fail fast for Cookie Mode.
- `canInstall` is `true` only on win32 (the auto-installer's support matrix).

### 5.5 Queue manager (`src/lib/queue/manager.ts`)

A process-wide singleton (`globalThis.__ytp_queue_manager__`, so it survives
Next.js dev hot reloads) that owns all download jobs.

**State held in memory:**

- `jobs: Map<jobId, QueueJob>` — job + latest progress
- `children: Map<jobId, ChildProcess>` — live yt-dlp processes
- `pending: string[]` — FIFO queue
- `running: Set<jobId>`

**Lifecycle:**

1. `enqueue(request, resumePlaylistId?)`:
   - resolves the output directory + yt-dlp filename template
     (`resolveOutput`) — videos go to `videoOutputDir` with
     `%(title)s [%(id)s].%(ext)s`; playlists get a sanitized subfolder named
     after the playlist with `%(playlist_index)03d - %(title)s [%(id)s].%(ext)s`
     plus an **archive file** at `data/archives/<hash(url)>.txt`;
   - creates the folder (`fs.mkdir recursive`);
   - **persists playlist state before starting** so progress survives crashes;
   - keeps the resolved build context (`outputTemplate`, `archivePath`,
     `playlistId`) in a private `ctxs` map keyed by job id (kept off the
     public `QueueJob` type);
   - captures the exact spawned command line on `job.command` (for the
     "copy command" UI);
   - persists in-flight jobs to `jobs.json` so a crash can reconcile them as
     `interrupted` history entries on the next boot;
   - pushes to `pending`, publishes an initial snapshot, and calls `pump()`.
2. `pump()` — the concurrency loop: while `running.size < maxConcurrent`
   and `pending` is non-empty, shift the next job and `run()` it. Concurrency
   comes from `settings.maxConcurrent` (default 2, clamped 1–6).
3. `run(job)` — builds argv, `runStream`s yt-dlp, wires line handlers:
   - every output line → `handleLine()` → `parseProgressLine()` → merge into
     `job.progress` → recompute blended percent → publish to the bus;
   - playlist index lines also trigger `touchPlaylist()` which recounts the
     archive file and updates `playlists.json` live (throttled to at most one
     write per second per playlist);
   - stderr is accumulated into a 4000-char tail ring for exit-time error
     classification;
   - spawn failure → the classified error is captured and handed to the
     single terminal path in `onClose`, so it is never overwritten by
     re-classifying the (empty) stderr tail.
4. `onClose(code)` — terminal handling:
   - `canceled` → mark playlist state `interrupted` (no history entry);
   - `code === 0` → `completed` at 100%, write history, playlist state
     `completed`;
   - non-zero → classify from the stderr tail: **playlists become
     `interrupted`** (with `--ignore-errors`, a non-zero exit may still have
     downloaded most items, and it must remain resumable), single videos
     become `failed`; both are written to history.
5. `cancel(id)` — the ordering is deliberate: the job is **marked `canceled`
   before the process is killed**, so any output lines still in flight from
   the dying process cannot resurrect the job to `downloading`; queued jobs
   are removed from `pending`; then `killProcessTree()` tears down yt-dlp
   and any ffmpeg it spawned.

`boot()` (lazy, triggered on first enqueue or by the playlists route) runs
`reconcileInterrupted()` — any playlist persisted as `downloading` must have
been cut off mid-flight (crash/restart), so it is promoted to `interrupted`
with a fresh archive count, making it resumable in the UI.

### 5.6 Progress bus + SSE (`src/lib/progress/emitter.ts`, `api/progress`)

`ProgressBus` is a process-wide `EventEmitter` singleton
(`globalThis.__ytp_progress_bus__`, `setMaxListeners(0)` for many SSE
clients). The queue manager `publish()`es every snapshot to the bus.

`GET /api/progress` opens a `ReadableStream` that:

1. **replays the current state** of every job from the queue manager on
   connect (so a page refresh immediately reflects reality),
2. forwards every `progressBus` event as an SSE `data:` frame,
3. sends a `: ping` **heartbeat every 15 s** to keep intermediaries from
   closing idle connections, and
4. cleans up its listener on stream cancel.

The browser opens **one** `EventSource` (in `useProgress`), demultiplexes by
`jobId`, and stores the latest snapshot per job. Native EventSource
auto-reconnect makes progress resilient to blips.

### 5.7 Persistence layer (`src/lib/store/`)

All runtime state is plain JSON under `DATA_DIR`:

- `DATA_DIR = $YTP_DATA_DIR` **or** `<cwd>/data` in dev
  (packaged: Electron `userData`).
- `readJson(file, fallback)` — tolerant of missing/corrupt files.
- `writeJson(file, value)` — **atomic**: write `<file>.<pid>.tmp`, then
  `rename` over the target, so a crash mid-write can't corrupt state.

| File | Contents |
|---|---|
| `settings.json` | `AppSettings` — output folders, cookie default, `maxConcurrent` (defaults for missing fields; `maxConcurrent` clamped 1–6 on save) |
| `history.json` | `HistoryEntry[]` — written on completed/failed/interrupted; upsert by job id; keeps the full request for retry; capped at the newest 500 entries; cleared via API |
| `playlists.json` | `PlaylistState[]` — saved before a playlist starts, updated live as items finish, reconciled on boot |
| `jobs.json` | In-flight (non-terminal) jobs — reconciled to `interrupted` history entries on boot |
| `archives/<hash>.txt` | yt-dlp `--download-archive` file — **the source of truth for resume**; `countArchive()` counts non-empty lines to derive `completed` |

Resume design: `--download-archive` records every completed video id, so a
resumed playlist re-runs yt-dlp with the same archive and skips everything
already done — even 1,000+ item playlists, across restarts and reboots.
The UI only needs the archive line count (no per-item tracking).

### 5.8 Tool resolution & installer (`src/lib/tools/`)

**Resolution order** (`resolveTool`):

1. explicit env var (`YT_DLP_PATH` / `FFMPEG_PATH`), if it exists on disk;
2. the app's own folder (next to the exe — `binDir()`) and its `bin/`
   subfolder (`yt-dlp.exe` / `ffmpeg.exe`);
3. the bare command name → system `PATH`.

`binDir()` resolves `YTP_BIN_DIR` → `PORTABLE_EXECUTABLE_DIR` (set by
electron-builder for portable builds) → `process.cwd()`. Tools are only ever
installed **into this folder** (never elsewhere) — a writability check
produces a clear "move the app somewhere writable" error otherwise.

**Installer** (`installer.ts`) — how the in-app install actually works,
step by step:

1. **Entry point.** The user clicks *Install* (or *Update*) on a tool — in
   the `SystemBanner` (Download screen), the `ToolsSection` (Settings), or
   via the sidebar status panel. All of them read one shared client store
   (`src/lib/tools/status-store.ts`, consumed through `useTools()`), whose
   `install()` POSTs `{ tool: "ytdlp" | "ffmpeg" }` to `/api/tools`, which
   returns `202` immediately; the install runs in the **background**
   (`void runInstall(tool).catch(...)`) and never blocks a request.

2. **Pre-flight guards** (`startInstall`):
   - non-Windows → error state *"Automatic install is only available on
     Windows. Please install the tool manually…"* (auto-install exists
     nowhere else);
   - a per-tool **busy guard** prevents double installs (a second click is
     a no-op while `downloading`/`extracting`);
   - a **writability check** on the target folder — if the app's folder
     isn't writable, an error tells the user to move the app somewhere
     writable (it never installs elsewhere).

3. **Target location.** Tools are always installed into the app's own
   folder: `pickInstallDir() = binDir()`, which resolves `YTP_BIN_DIR` →
   `PORTABLE_EXECUTABLE_DIR` (the folder containing the portable exe) →
   `process.cwd()`. Final paths: `<app folder>/yt-dlp.exe` and
   `<app folder>/ffmpeg.exe` (per `toolInstallPath`).

4. **yt-dlp**: streams the official
   `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`
   straight to `<app folder>/yt-dlp.exe`. Progress = bytes received vs
   `Content-Length`, reported 0–100%.

5. **ffmpeg** (the more involved one):
   - downloads the large BtbN build
     (`ffmpeg-master-latest-win64-gpl.zip`) into a **temp directory**
     (`os.tmpdir()/ytp-ffmpeg-*`), with download percent **capped at 85%**
     (the last 15% is reserved for extraction);
   - at 90% switches to *"Extracting…"* and uses `yauzl` with
     `lazyEntries: true` to **stream only `ffmpeg.exe` and `ffprobe.exe`**
     out of the archive (matched by basename) directly into the app folder
     — the ~100 MB archive is never fully unpacked;
   - verifies `ffmpeg.exe` was actually extracted before reporting
     `done` at 100%;
   - the temp dir is always removed in a `finally` block.

6. **Progress reporting & verification.** Install state lives in an
   in-memory singleton (`globalThis.__ytp_installer_state__`, so it survives
   dev hot reloads): `{ tool, state: idle|downloading|extracting|done|error,
   percent, message, path }`. On the client, the shared `status-store.ts`
   owns the poll loop: it polls `GET /api/tools` **every 1 second** while a
   tool is busy and renders a live progress bar + status message on every
   surface at once — Settings row, home banner, sidebar panel — because they
   all subscribe to the same store (an install started anywhere updates
   everywhere; no navigation or restart needed). Polling stops only when the
   server reports `done` **and** the system probe confirms the binary is
   actually detectable; a brand-new exe can fail its first probe (Defender
   scan / PyInstaller first-run extraction), so the store keeps polling
   through a 45 s grace window and then surfaces a *"downloaded but could
   not be verified"* error instead of freezing. `GET /api/tools` caches the
   (subprocess-based) probe for ~2 s and skips probing entirely while an
   install is mid-flight — the binary cannot have appeared yet — forcing a
   fresh probe the moment the install completes. Any failure (HTTP error,
   `ffmpeg.exe` missing from the archive, unwritable folder) lands in
   `message` and renders as a red error box.

7. **Resolution afterwards.** The system probe (`getSystemStatus` — the
   same probe the poll loop uses to verify completion) finds the new binary
   via rule 2 (app folder) — the install target and the lookup path are
   deliberately the same place. *Update* is the identical flow: it
   re-downloads the latest release over the existing binary (no version
   comparison). Note that rule 2 **beats** rule 3 (system `PATH`), so once
   installed via the button, the app always uses the freshly installed
   copy even if a different yt-dlp/ffmpeg exists on the PATH.

### 5.9 Electron shell (`electron/main.js`)

Covered in §4.1. Notable details:

- **Single instance** lock; second launch restores/focuses the window.
- **Splash → app** swap driven by server polling (100 ms intervals) so the
  window never sits blank.
- **Error page** on server crash (with the exit code).
- External links (e.g. video source pages) open in the system browser —
  `setWindowOpenHandler` denies in-app windows.
- `contextIsolation: true`, `nodeIntegration: false` — the renderer has no
  Node access; it is a plain web page talking HTTP to the local server.
- In packaged mode the server runs under **Electron's own binary as Node**
  (`ELECTRON_RUN_AS_NODE=1`), so the exe is the only runtime needed.

### 5.10 UI layer & design system

**Screens:**

- **Download (`/`)** — the main flow: URL input + Cookie Mode toggle →
  analyze → options panels (video quality / audio / subtitles) or playlist
  panel → download button; live `DownloadQueue` below. The whole screen state
  (URL, analysis, selections) is mirrored to `sessionStorage`
  (`ytp_home_state_v1`), so navigating to Settings and back preserves
  everything. Jobs are polled every 2.5 s for list refreshes; progress comes
  via SSE, and the cached analysis is silently re-analyzed on return so
  formats are never stale. Completed jobs expose **Open folder** and
  **Copy command** actions.
- **Library (`/downloads`)** — download history (sorted newest first) and
  **resume cards** for interrupted playlists (completed/total + progress bar);
  Resume POSTs and navigates home. Failed entries with a saved request can be
  **retried** directly, and every row can open its output folder in Explorer.
- **Settings (`/settings`)** — output folders, cookie default, concurrency,
  and the `ToolsSection` installer with per-tool install/update + live
  progress bars.

**Shared pieces:** `Button` (4 variants, loading state), `Toggle`,
`Badge` (6 tones), `OptionRow` (radio rows), `SectionTitle`, `ProgressBar`
(status-colored, animated sheen while active), inline SVG icon set.

**"Studio Precision" design system** (`tailwind.config.ts`, `globals.css`,
spec in `UI REQUIRMENT/studio_precision/DESIGN.md`):

- **Palette**: deep blue-charcoal canvas (`#0b1326`), raised panels
  (`#141d31`/`#222a3d`), **teal accent** `#2DD4BF` for system/status/progress,
  **salmon-pink** `#F43F5E` for actions/CTAs, plus info/warn/danger tones and
  a cool near-white ink scale.
- **Type**: Inter (UI) + JetBrains Mono (technical readouts: paths, sizes,
  bitrates) loaded via `next/font`.
- **Motion**: springy `ease-spring` interactions, staggered panel entrances,
  per-navigation `page-in` animation (via `template.tsx`), animated aurora
  gradient backdrop, progress-bar sheen, shimmer skeletons — all disabled by
  `prefers-reduced-motion`.
- Custom scrollbars, focus-visible rings, and component classes (`panel`,
  `skeleton`, `stagger`, `card-hover`, `progress-sheen`).

---

## 6. End-to-end flows

### 6.1 Analyze a URL

```
UI (page.tsx) ──POST /api/analyze {url, cookieMode}──▶ route
                                                      └─ validate URL (isValidUrl)
                                                         └─ analyzeUrl()
                                                            └─ spawn: yt-dlp -J --flat-playlist ... (60s cap)
                                                               └─ parse JSON
                                                                  ├─ playlist → metadata + count
                                                                  └─ video   → qualities + subs + sizes
route ──200 AnalysisResult──▶ UI renders MetadataCard + option panels
```

Errors (private/age-restricted/unavailable/geo/network/…) are classified by
`errors.ts`, serialized as `ApiError {error, code, hint}`, and rendered as a
red banner with the remediation hint.

### 6.2 Download with live progress

```
UI ──POST /api/download (DownloadRequest)──▶ queueManager.enqueue()
                                              ├─ resolve output dir/template/archive
                                              ├─ persist playlist state (playlists.json)
                                              ├─ job → pending → pump()
                                              │   └─ spawn yt-dlp (--newline + progress template)
                                              │      ├─ stdout lines → parseProgressLine()
                                              │      │   └─ merge → overallPercent()
                                              │      └─ progressBus.publish(snapshot)
                                              └─ 202 {jobId}
                                                  ▲
UI ◀──SSE /api/progress── progressBus ───────────┘
      useProgress() stores snapshot per jobId
      DownloadQueue renders bar/speed/ETA/file; 2.5s job-list poll keeps the row set fresh
```

### 6.3 Cancel

`DELETE /api/download?id=` → `queueManager.cancel()` → mark `canceled` first
(resurrection guard) → remove from pending/running → `killProcessTree()`
(`taskkill /T` on Windows) → the process dies, `onClose` sees `canceled` and
marks any playlist state `interrupted`. No history entry is written for
cancels.

### 6.4 Resume an interrupted playlist

```
Library UI ──POST /api/playlists {id}──▶ queueManager.resumePlaylist(id)
                                          └─ enqueue(saved request, playlistId)
                                             └─ same archivePath (data/archives/<hash>.txt)
                                                └─ yt-dlp --download-archive <file>
                                                   → completed items skipped, remainder fetched
```

`GET /api/playlists` first boots the manager, which reconciles stale
`downloading` states → `interrupted` so the resume cards appear after a crash.

### 6.5 Install / update a tool

```
UI ──POST /api/tools {tool}──▶ startInstall()  (win32 + writable check)
                                ├─ yt-dlp: stream exe from GitHub latest release
                                └─ ffmpeg:  stream BtbN zip (85%) → extract ffmpeg.exe+ffprobe.exe (100%)
UI ◀─GET /api/tools (poll 1s; probe cached 2s and skipped while busy)── install state
     shared status-store loop ──▶ stops only when done AND the probe detects the binary
     (sidebar, banner and Settings render the same live state; no navigation needed)
```

---

## 7. Job state machine

```
                enqueue                  spawn yt-dlp
   (created) ──────────▶ queued ────────────────────▶ downloading ──▶ processing ──▶ completed
                            │  ▲                         │   ▲            (ffmpeg   (exit 0,
                            │  │                         │   │         post-step)   + history)
                     cancel │  │                  cancel │   │
                            ▼  │                         ▼   │
                         canceled ──────────────▶ (killed; playlist → interrupted; no history)

   downloading/processing ── non-zero exit ──▶ failed  (video; + history)
   downloading/processing ── non-zero exit ──▶ interrupted (playlist; + history, resumable)
   spawn error ──▶ failed (classified); restart reconcile: persisted "downloading" → "interrupted"
```

Notes:

- Jobs jump straight from `queued` to `downloading` (an `analyzing` state was
  removed from the model as dead code).
- Terminal states are sticky: `handleLine` ignores all output after a job is
  `canceled`/`failed` so a straggling process can't flip it back.

---

## 8. On-disk data model

```
<DATA_DIR>/                          # $YTP_DATA_DIR or ./data (dev) / Electron userData (packaged)
├── settings.json                    # { videoOutputDir, playlistOutputDir, cookieModeDefault, maxConcurrent }
├── history.json                     # [ { id, title, url, date, outputLocation, type, status,
│                                    #     playlistTotal?, playlistCompleted?, archivePath? } ]
├── jobs.json                       # in-flight (non-terminal) jobs — crash reconciliation
├── playlists.json                   # [ { id, title, url, total, completed, archivePath,
│                                    #     outputDir, request, status, updatedAt } ]
└── archives/
    └── <djb2-hash of url>.txt       # one line per completed video id (yt-dlp --download-archive)
```

- Every JSON write is atomic (temp + rename); reads fall back to defaults on
  corruption.
- `history.json` grows unboundedly unless cleared via the Library UI.
- Playlist `id` is `hashId(url)` — a stable short base-36 hash, so resume
  reuses the same archive across runs.

---

## 9. Environment variables

| Variable | Effect |
|---|---|
| `YT_DLP_PATH` | Explicit yt-dlp binary path (highest precedence) |
| `FFMPEG_PATH` | Explicit ffmpeg binary path |
| `YTP_BIN_DIR` | Where tools are looked up / installed (default: next to the exe) |
| `YTP_DATA_DIR` | Where state lives (default: Electron userData, or `./data` in dev) |
| `PORTABLE_EXECUTABLE_DIR` | Set by electron-builder portable runtime; used as `binDir` fallback |
| `PORT` / `HOSTNAME` | Set by Electron main for the spawned server |
| `ELECTRON_RUN_AS_NODE` | Makes the Electron binary run as plain Node for the server |
| `NEXT_TELEMETRY_DISABLED` | Set by main to skip telemetry startup work |

---

## 10. Concurrency & failure semantics

- **Concurrent downloads**: `maxConcurrent` (1–6, default 2) enforced by the
  queue's `pump()` loop. New jobs run as soon as a slot frees up.
- **Cancellation is a full tree kill** — `taskkill /T` prevents orphaned
  yt-dlp/ffmpeg processes from continuing to write files.
- **Interrupted playlists are resumable, failed videos are not** — a
  playlist's partial progress is always persisted (state + archive).
- **Jobs survive restarts as `interrupted` entries**: in-flight jobs are
  persisted to `jobs.json` and reconciled on boot; playlist state
  additionally survives via `playlists.json` + archive files and is
  reconciled to `interrupted`.
- **History** is written for `completed` / `failed` / `interrupted` only —
  canceled jobs never appear.
- **Disk writes are crash-safe** (atomic rename), and **state reads are
  corruption-tolerant** (fallback defaults).

---

## 11. Build & packaging

```
npm run app:build     = next build  (output: "standalone")
                      + node scripts/prepare-standalone.mjs
npm run dist          = app:build + electron-builder --win portable
                        → release/yt-dlp-studio.exe
```

- `next.config.js` sets `output: "standalone"` — Next emits a self-contained
  server (`server.js` + traced `node_modules`) that Electron can run without
  the full dev tree.
- `prepare-standalone.mjs` fixes a known gap: Next does **not** copy
  `.next/static` or `public/` into the standalone output, so the script
  copies both into place.
- electron-builder config: `asar: true` with `asarUnpack: [".next/standalone/**"]`
  — the standalone server is extracted next to the asar so the child process
  can serve real files (main.js resolves it under
  `process.resourcesPath/app.asar.unpacked`); `files` includes `electron/**`,
  `.next/standalone/**`, `ICON.ico`; portable target `yt-dlp-studio.exe`.
- **Windows symlink note**: electron-builder's `winCodeSign` download
  contains macOS symlinks; extracting it needs the *Create symbolic links*
  privilege — enable Developer Mode or build from an elevated terminal.
- The final exe is fully self-contained: it embeds the server and downloads
  yt-dlp/ffmpeg next to itself on first use (Windows).

---

## 12. Security model

- **Local-only**: the server binds `127.0.0.1`; the renderer has
  `nodeIntegration: false` and `contextIsolation: true`, so the UI is a plain
  web page with no Node access.
- **Input hardening**: URLs are validated (`http`/`https` only) before any
  command runs; folder names are sanitized against Windows-illegal
  characters, reserved device names, and excessive length — yt-dlp receives
  only validated inputs; user-controlled strings never interpolate into a
  shell (spawn uses argv arrays, not a shell).
- **No secrets stored**: cookie mode reads Firefox's profile on demand; the
  app persists no credentials.
- **Loopback-only enforcement**: a middleware rejects any request whose
  `Host` header is not `localhost` / `127.0.0.1` / `[::1]` — a
  DNS-rebinding guard for the local API.
- **Security headers**: `Content-Security-Policy` (`default-src 'self'`,
  remote content limited to images), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
- **Documented limitation** (README): this is a local tool that spawns
  processes and writes files on the host — it must not be exposed to
  untrusted networks without adding authentication.

---

## 13. Edge cases & observations (as implemented)

These are behaviors visible in the current code, worth knowing before
touching the codebase:

1. **Spawn failures keep their classified message**: `onError` captures the
   classified error (e.g. `YTDLP_MISSING`) and `onClose` uses it instead of
   re-classifying the empty stderr tail — previously `job.error` could be
   overwritten with a generic `UNKNOWN` message.
2. **`handleLine`'s `completed` guard** (`next.status === "completed" ? ...`)
   is defensive/no-op today: `parseProgressLine` never returns `completed`.
3. **Playlist non-zero exit ⇒ `interrupted`, not `failed`** — even if nothing
   was downloaded, because `--ignore-errors` makes partial success the
   expected outcome.
4. **Canceled jobs leave no history entry** (by design), and canceling a
   playlist marks it `interrupted` so it can be resumed later.
5. **Analysis data can go stale**: the Download screen caches the full
   `AnalysisResult` in `sessionStorage`; formats/metadata shown may differ
   from the current live state on re-analysis.
6. **Analysis of a very large playlist** is fast (`--flat-playlist`) but the
   route allows up to 120 s; downloads have no timeout (correct for long
   files), cancellation is the user's escape hatch.
7. **Remote thumbnails** are plain `<img>` tags (with an eslint-disable) —
   `next/image` is not used, and the dead `images.remotePatterns` config was
   removed during cleanup.

---

## 14. Development workflow

```bash
npm install             # install deps
npm run electron:dev    # next dev on :3000 + Electron window (concurrently + wait-on)
npm run dev             # web-only, http://localhost:3000
npm run typecheck       # tsc --noEmit
npm run lint            # eslint . (neostandard flat config)
npm test                # vitest run (unit tests)
npm run app:build       # standalone build + asset copy
npm run dist            # full portable exe → release/yt-dlp-studio.exe
```

Dev tips:

- In dev, state lands in `./data` — wipe it to reset settings/history/playlists.
- Tools resolve to `<cwd>/yt-dlp.exe`/`ffmpeg.exe` if present (a copy already
  sits in the repo root), else system PATH; `YTP_BIN_DIR` can redirect.
- The queue manager, progress bus, and installer state are singletons on
  `globalThis` — they intentionally survive Next.js hot reloads.
- Design specs and mockups live under `UI REQUIRMENT/` (product brief,
  `studio_precision/DESIGN.md`, per-screen HTML mockups) — the implemented UI
  follows them closely.

---

*Last verified against the working tree: settings/history/playlists routes,
queue manager, yt-dlp service layer, tools installer, Electron main, and all
three screens.*

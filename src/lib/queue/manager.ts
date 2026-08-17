import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { runStream, ytDlpBinary, killProcessTree } from "@/lib/ytdlp/exec";
import { buildDownloadArgs } from "@/lib/ytdlp/download";
import { parseProgressLine, overallPercent } from "@/lib/ytdlp/progress";
import { classifyYtDlpError, type YtDlpError } from "@/lib/ytdlp/errors";
import { progressBus } from "@/lib/progress/emitter";
import { getSettings } from "@/lib/store/settings";
import { upsertHistory } from "@/lib/store/history";
import { readJson, writeJson } from "@/lib/store/json-store";
import {
  archivePathFor,
  countArchive,
  reconcileInterrupted,
  savePlaylistState,
  getPlaylistState,
} from "@/lib/store/playlist-state";
import { sanitizeFolderName, hashId } from "@/lib/utils/sanitize";
import type { DownloadRequest, JobStatus, ProgressSnapshot, QueueJob } from "@/types";

/** Where in-flight jobs are persisted so a crash can be reconciled on boot. */
const JOBS_FILE = "jobs.json";

/** Resolved build context for a job, kept off the public QueueJob type. */
interface JobCtx {
  outputTemplate: string;
  archivePath?: string;
  playlistId?: string;
}

/** Shape of a job persisted to disk (in-flight jobs only). */
interface PersistedJob {
  id: string;
  request: DownloadRequest;
  outputDir: string;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  ctx?: JobCtx;
}

/** Shell-friendly quoting for the "copy yt-dlp command" feature. */
function quoteArg(a: string): string {
  return /\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

class QueueManager {
  private jobs = new Map<string, QueueJob>();
  private children = new Map<string, ChildProcessWithoutNullStreams>();
  private pending: string[] = [];
  private running = new Set<string>();
  private ctxs = new Map<string, JobCtx>();
  /** Last write timestamp per playlist, so live state updates are throttled. */
  private lastPlaylistWrite = new Map<string, number>();
  private booted = false;

  /** Reconcile state left over from a previous run (playlists + persisted jobs). Called lazily. */
  async boot() {
    if (this.booted) return;
    this.booted = true;
    await reconcileInterrupted();
    await this.reconcilePersistedJobs();
  }

  list(): QueueJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Enqueue a new download. Returns the created job id. */
  async enqueue(request: DownloadRequest, resumePlaylistId?: string): Promise<string> {
    await this.boot();
    const settings = await getSettings();
    const id = randomUUID();

    // Resolve output directory + template based on job kind.
    const { outputDir, outputTemplate, archivePath, playlistId } =
      await this.resolveOutput(request, settings, resumePlaylistId);

    const job: QueueJob = {
      id,
      request: { ...request, outputDir },
      status: "queued",
      outputDir,
      createdAt: Date.now(),
      progress: this.blankProgress(id),
    };
    this.jobs.set(id, job);

    // Persist playlist state up-front so progress survives restarts.
    if (request.kind === "playlist" && archivePath && playlistId) {
      const existing = await getPlaylistState(playlistId);
      const completed = await countArchive(archivePath);
      await savePlaylistState({
        id: playlistId,
        title: request.title ?? existing?.title ?? "Playlist",
        url: request.url,
        total: existing?.total ?? 0,
        completed,
        archivePath,
        outputDir,
        request: { ...request, outputDir },
        status: "downloading",
        updatedAt: Date.now(),
      });
    }

    this.ctxs.set(id, { outputTemplate, archivePath, playlistId });

    this.pending.push(id);
    this.publish(job);
    this.persist();
    this.pump(settings.maxConcurrent);
    return id;
  }

  /** Resume an interrupted playlist using its saved state + archive file. */
  async resumePlaylist(playlistId: string): Promise<string> {
    const state = await getPlaylistState(playlistId);
    if (!state) throw new Error("No saved state for this playlist.");
    return this.enqueue(state.request, playlistId);
  }

  /** Cancel a running or queued job. */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    // Mark canceled BEFORE killing so any output lines still in flight see the
    // canceled state and can't resurrect the job back to "downloading".
    this.transition(job, "canceled");
    this.pending = this.pending.filter((p) => p !== id);
    this.running.delete(id);
    const child = this.children.get(id);
    if (child) killProcessTree(child);
    this.persist();
    return true;
  }

  // ----------------------------------------------------------------

  private pump(maxConcurrent: number) {
    while (this.running.size < maxConcurrent && this.pending.length > 0) {
      const id = this.pending.shift()!;
      const job = this.jobs.get(id);
      if (!job || job.status === "canceled") continue;
      this.running.add(id);
      void this.run(job);
    }
  }

  private async run(job: QueueJob) {
    const ctx = this.ctxs.get(job.id);
    if (!ctx) {
      this.fail(job, "Job context is missing.");
      return;
    }
    job.startedAt = Date.now();
    this.transition(job, "downloading");

    const args = buildDownloadArgs(job.request, {
      outputTemplate: ctx.outputTemplate,
      archivePath: ctx.archivePath,
    });
    job.command = `${ytDlpBinary()} ${args.map(quoteArg).join(" ")}`;

    let stderrTail = "";
    let spawnError: YtDlpError | null = null;

    const child = runStream(ytDlpBinary(), args, {
      onStdoutLine: (line) => this.handleLine(job, line),
      onStderrLine: (line) => {
        stderrTail = (stderrTail + "\n" + line).slice(-4000);
        this.handleLine(job, line);
      },
      // A failed spawn emits "error" and then "close" (code null). Capture the
      // classified error here so the single terminal path in onClose reports it
      // instead of re-classifying the (empty) stderr tail.
      onError: (err) => {
        spawnError = classifyYtDlpError(err, "");
      },
      onClose: (code) => void this.onClose(job, code, stderrTail, spawnError),
    });

    this.children.set(job.id, child);
  }

  private handleLine(job: QueueJob, line: string) {
    // Once a job is finished (canceled/failed), ignore any trailing output so a
    // straggling or orphaned process can't flip it back to "downloading".
    if (job.status === "canceled" || job.status === "failed") return;
    const update = parseProgressLine(line);
    if (!update) return;
    const next: ProgressSnapshot = { ...job.progress, ...update };
    next.percent = overallPercent(next);
    job.progress = next;
    if (update.status) job.status = update.status;
    this.publish(job);

    // Live-update playlist completed count as items finish.
    if (update.playlistIndex && this.ctxs.get(job.id)?.playlistId) {
      void this.touchPlaylist(job, update.playlistIndex);
    }
  }

  private async onClose(
    job: QueueJob,
    code: number | null,
    stderrTail: string,
    spawnError: YtDlpError | null = null
  ) {
    this.children.delete(job.id);
    this.running.delete(job.id);

    if (job.status === "canceled") {
      await this.recordPlaylistEnd(job, "interrupted");
      this.afterFinish();
      return;
    }

    if (code === 0) {
      job.finishedAt = Date.now();
      this.transition(job, "completed", { percent: 100 });
      await this.recordHistory(job, "completed");
      await this.recordPlaylistEnd(job, "completed");
    } else {
      // For playlists, --ignore-errors means a non-zero exit may still have
      // downloaded most items; treat it as interrupted rather than failed.
      const err = spawnError ?? classifyYtDlpError(null, stderrTail);
      if (job.request.kind === "playlist") {
        this.transition(job, "interrupted", { error: err.message });
        await this.recordHistory(job, "interrupted", err.message);
        await this.recordPlaylistEnd(job, "interrupted");
      } else {
        this.fail(job, err.message);
        await this.recordHistory(job, "failed", err.message);
      }
    }
    this.afterFinish();
  }

  private afterFinish() {
    this.persist();
    void getSettings().then((s) => this.pump(s.maxConcurrent));
  }

  // ---- helpers ----

  private async resolveOutput(
    request: DownloadRequest,
    settings: { videoOutputDir: string; playlistOutputDir: string },
    resumePlaylistId?: string
  ): Promise<{
    outputDir: string;
    outputTemplate: string;
    archivePath?: string;
    playlistId?: string;
  }> {
    if (request.kind === "playlist") {
      const playlistId = resumePlaylistId ?? hashId(request.url);
      const folder = sanitizeFolderName(request.title ?? "Playlist");
      const base = request.outputDir ?? settings.playlistOutputDir;
      const outputDir = path.join(base, folder);
      await fs.mkdir(outputDir, { recursive: true });
      const archivePath = archivePathFor(playlistId);
      const outputTemplate = path.join(
        outputDir,
        "%(playlist_index)03d - %(title)s [%(id)s].%(ext)s"
      );
      return { outputDir, outputTemplate, archivePath, playlistId };
    }

    const outputDir = request.outputDir ?? settings.videoOutputDir;
    await fs.mkdir(outputDir, { recursive: true });
    const outputTemplate = path.join(outputDir, "%(title)s [%(id)s].%(ext)s");
    return { outputDir, outputTemplate };
  }

  private async touchPlaylist(job: QueueJob, index: number) {
    const ctx = this.ctxs.get(job.id);
    if (!ctx?.playlistId || !ctx.archivePath) return;
    // Throttle: the archive is re-counted on every item finish; coalesce
    // writes to at most one per second per playlist.
    const now = Date.now();
    if (now - (this.lastPlaylistWrite.get(ctx.playlistId) ?? 0) < 1000) return;
    this.lastPlaylistWrite.set(ctx.playlistId, now);
    const state = await getPlaylistState(ctx.playlistId);
    if (!state) return;
    const completed = await countArchive(ctx.archivePath);
    await savePlaylistState({
      ...state,
      completed,
      total: Math.max(state.total, job.progress.playlistTotal ?? index),
      status: "downloading",
      updatedAt: Date.now(),
    });
  }

  private async recordPlaylistEnd(
    job: QueueJob,
    status: "completed" | "interrupted"
  ) {
    const ctx = this.ctxs.get(job.id);
    if (!ctx?.playlistId || !ctx.archivePath) return;
    this.lastPlaylistWrite.delete(ctx.playlistId);
    const state = await getPlaylistState(ctx.playlistId);
    if (!state) return;
    const completed = await countArchive(ctx.archivePath);
    await savePlaylistState({ ...state, completed, status, updatedAt: Date.now() });
  }

  private async recordHistory(
    job: QueueJob,
    status: "completed" | "failed" | "interrupted",
    error?: string
  ) {
    const ctx = this.ctxs.get(job.id);
    let playlistTotal: number | undefined;
    let playlistCompleted: number | undefined;
    if (job.request.kind === "playlist" && ctx?.archivePath) {
      playlistCompleted = await countArchive(ctx.archivePath);
      playlistTotal = job.progress.playlistTotal ?? playlistCompleted;
    }
    await upsertHistory({
      id: job.id,
      title: job.request.title ?? job.request.url,
      url: job.request.url,
      date: Date.now(),
      outputLocation: job.outputDir,
      type: job.request.type,
      status,
      playlistTotal,
      playlistCompleted,
      archivePath: ctx?.archivePath,
      // The full request is kept so failed downloads can be retried from the
      // Library screen without re-analyzing.
      request: job.request,
    });
    if (error) job.error = error;
  }

  private blankProgress(jobId: string): ProgressSnapshot {
    return {
      jobId,
      status: "queued",
      percent: 0,
      currentFile: null,
      speed: null,
      eta: null,
    };
  }

  private transition(job: QueueJob, status: JobStatus, extra: Partial<ProgressSnapshot> = {}) {
    job.status = status;
    job.progress = { ...job.progress, ...extra, status };
    if (extra.error) job.error = extra.error;
    this.publish(job);
  }

  private fail(job: QueueJob, message: string) {
    this.children.delete(job.id);
    this.running.delete(job.id);
    job.error = message;
    this.transition(job, "failed", { error: message });
  }

  private publish(job: QueueJob) {
    progressBus.publish({ ...job.progress, status: job.status });
  }

  // ---- persistence of in-flight jobs ----

  /** Write only in-flight jobs so a crash can reconcile them on next boot. */
  private persist() {
    const entries: PersistedJob[] = [...this.jobs.values()]
      .filter((j) => j.status === "queued" || j.status === "downloading" || j.status === "processing")
      .map((j) => ({
        id: j.id,
        request: j.request,
        outputDir: j.outputDir,
        status: j.status,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        ctx: this.ctxs.get(j.id),
      }));
    void writeJson(JOBS_FILE, entries).catch(() => {
      // Persistence is best-effort; losing it only costs the interrupted notice.
    });
  }

  /**
   * Jobs that were mid-flight when the app last died become "interrupted"
   * history entries so the user can see what was lost (and retry it).
   */
  private async reconcilePersistedJobs() {
    const stored = await readJson<PersistedJob[]>(JOBS_FILE, []);
    if (stored.length === 0) return;
    for (const entry of stored) {
      if (
        entry.status === "completed" ||
        entry.status === "failed" ||
        entry.status === "interrupted" ||
        entry.status === "canceled"
      ) {
        continue;
      }
      const job: QueueJob = {
        id: entry.id,
        request: entry.request,
        status: "interrupted",
        outputDir: entry.outputDir,
        createdAt: entry.createdAt,
        startedAt: entry.startedAt,
        progress: this.blankProgress(entry.id),
        error: "The app was closed while this download was running.",
      };
      if (entry.ctx) this.ctxs.set(entry.id, entry.ctx);
      await this.recordHistory(job, "interrupted", job.error);
      await this.recordPlaylistEnd(job, "interrupted");
    }
    await writeJson(JOBS_FILE, []).catch(() => {});
  }
}

// Singleton across hot reloads / requests.
const KEY = "__ytp_queue_manager__";
const g = globalThis as unknown as Record<string, QueueManager | undefined>;
export const queueManager: QueueManager = g[KEY] ?? (g[KEY] = new QueueManager());

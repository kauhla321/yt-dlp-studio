// Browser-side API client. Thin fetch wrappers with typed results and a
// consistent error surface (throws Error with the server's friendly message).

import type {
  AnalysisResult,
  AppSettings,
  DownloadRequest,
  HistoryEntry,
  PlaylistState,
  QueueJob,
  SystemStatus,
  ToolInstallStatus,
  ToolName,
} from "@/types";
import { isApiError } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok || isApiError(data)) {
    const message = isApiError(data) ? data.error : `Request failed (${res.status})`;
    const err = new Error(message) as Error & { hint?: string; code?: string };
    if (isApiError(data)) {
      err.hint = data.hint;
      err.code = data.code;
    }
    throw err;
  }
  return data as T;
}

export const api = {
  system: () => request<SystemStatus>("/api/system"),

  tools: () =>
    request<{
      system: SystemStatus;
      installs: Record<ToolName, ToolInstallStatus>;
    }>("/api/tools"),
  installTool: (tool: ToolName) =>
    request<ToolInstallStatus>("/api/tools", {
      method: "POST",
      body: JSON.stringify({ tool }),
    }),

  analyze: (url: string, cookieMode: boolean) =>
    request<AnalysisResult>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ url, cookieMode }),
    }),

  download: (req: DownloadRequest) =>
    request<{ jobId: string }>("/api/download", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  jobs: () => request<{ jobs: QueueJob[] }>("/api/download"),

  cancel: (id: string) =>
    request<{ canceled: boolean }>(`/api/download?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  openPath: (p: string) =>
    request<{ opened: boolean }>("/api/open", {
      method: "POST",
      body: JSON.stringify({ path: p }),
    }),

  history: () => request<{ entries: HistoryEntry[] }>("/api/history"),
  clearHistory: () => request<{ cleared: boolean }>("/api/history", { method: "DELETE" }),

  playlists: () => request<{ playlists: PlaylistState[] }>("/api/playlists"),
  resumePlaylist: (id: string) =>
    request<{ jobId: string }>("/api/playlists", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  settings: () => request<AppSettings>("/api/settings"),
  saveSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>("/api/settings", {
      method: "POST",
      body: JSON.stringify(patch),
    }),
};

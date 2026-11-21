// Bridge to the Electron preload (electron/preload.js). Absent when the UI runs
// in a plain browser (`next dev`), so every caller must handle "unavailable".

interface DesktopBridge {
  pickFolder(defaultPath?: string): Promise<string | null>;
}

declare global {
  interface Window {
    ytpDesktop?: DesktopBridge;
  }
}

/** True when running inside the desktop app with native dialogs available. */
export function canPickFolder(): boolean {
  return typeof window !== "undefined" && typeof window.ytpDesktop?.pickFolder === "function";
}

/** Show the native folder chooser. Resolves to null if canceled or unavailable. */
export async function pickFolder(defaultPath?: string): Promise<string | null> {
  if (!canPickFolder()) return null;
  try {
    return await window.ytpDesktop!.pickFolder(defaultPath);
  } catch {
    return null;
  }
}

// Preload for yt-dlp Studio. Exposes a tiny, explicit desktop API to the page
// (contextIsolation stays on; the page never gets ipcRenderer itself).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ytpDesktop", {
  /** Open the native "choose folder" dialog. Resolves to the path, or null if canceled. */
  pickFolder: (defaultPath) =>
    ipcRenderer.invoke("ytp:pick-folder", typeof defaultPath === "string" ? defaultPath : ""),
});

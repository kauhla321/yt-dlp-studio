// Electron main process for yt-dlp Studio.
//
// Runs the Next.js standalone server as a child process (using Electron's own
// binary as Node via ELECTRON_RUN_AS_NODE) and shows it in a native window.
// In development it simply points at the already-running `next dev` server.

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

const isDev = !app.isPackaged;
const HOST = "127.0.0.1";

let serverProcess = null;
let mainWindow = null;
let appUrl = null;

/** Find an available TCP port (dev server uses the fixed 3000). */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, HOST, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Resolve where the portable exe lives, for tool lookup/installation. */
function portableDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(process.execPath);
  return process.cwd();
}

/** Poll the server until it responds (or time out). */
function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Server did not start in time."));
        // Poll eagerly so the window swaps from splash to app as soon as the
        // server is listening, instead of waiting up to a full interval.
        else setTimeout(tryOnce, 100);
      });
    };
    tryOnce();
  });
}

function startServer(port) {
  // With asar enabled, the standalone output is unpacked next to the asar so
  // the child server can read and serve real files. In dev the plain path is
  // the project's own .next/standalone.
  const unpacked = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    ".next",
    "standalone",
    "server.js"
  );
  const serverJs =
    app.isPackaged && fs.existsSync(unpacked) ? unpacked : path.join(app.getAppPath(), ".next", "standalone", "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(`Standalone server not found at ${serverJs}. Did you run \`npm run app:build\`?`);
  }

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: path.dirname(serverJs),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      // Skip Next.js telemetry startup work — shaves time off server boot.
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      HOSTNAME: HOST,
      // Persist user data per-user; look for / install tools next to the exe.
      YTP_DATA_DIR: app.getPath("userData"),
      YTP_BIN_DIR: portableDir(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[next] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[next] ${d}`));
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (code && code !== 0 && !app.isQuitting) {
      // Server died unexpectedly — surface it rather than showing a blank window.
      if (mainWindow) mainWindow.webContents.loadURL(errorPage(`Server exited with code ${code}.`));
    }
  });
}

function splashPage(message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{height:100%;margin:0}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:#020617;color:#F8FAFC;font-family:system-ui,sans-serif;gap:14px}
    .ring{width:34px;height:34px;border:3px solid #1E2A44;border-top-color:#22C55E;
      border-radius:50%;animation:s 0.9s linear infinite}
    @keyframes s{to{transform:rotate(360deg)}}
    .t{font-size:13px;color:#94A3B8}</style></head>
    <body><div class="ring"></div><div class="t">${message}</div></body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function errorPage(message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{background:#020617;color:#F87171;font-family:system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center}
    </style></head><body><div><h3>yt-dlp Studio failed to start</h3><p>${message}</p></div></body></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function createWindow() {
  // Prefer a bundled icon next to main.js, then the build-root ICON.ico.
  const iconPath = [
    path.join(__dirname, "icon.ico"),
    path.join(__dirname, "..", "ICON.ico"),
  ].find((p) => fs.existsSync(p));
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: "#020617",
    title: "yt-dlp Studio",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (e.g. source webpage) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(splashPage("Starting yt-dlp Studio…"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  createWindow();
  try {
    const port = isDev ? 3000 : await getFreePort();
    appUrl = `http://${HOST}:${port}`;
    if (!isDev) startServer(port);
    await waitForServer(appUrl);
    if (mainWindow) mainWindow.loadURL(appUrl);
  } catch (err) {
    if (mainWindow) mainWindow.loadURL(errorPage(String(err && err.message ? err.message : err)));
  }
}

// Single-instance: focus the existing window instead of opening a second.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {
        /* ignore */
      }
      serverProcess = null;
    }
  });
}

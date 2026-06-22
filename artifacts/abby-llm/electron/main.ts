import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

/**
 * Abby LLM — Electron main process.
 *
 * Security: contextIsolation ON, nodeIntegration OFF, sandbox ON.
 * The renderer only talks to Node through the typed contextBridge in preload.ts.
 *
 * In production the embedded API server (the real LLM engine) is started as a
 * child process; it serves BOTH /api and the static React frontend, so the
 * renderer loads a single local origin and all relative /api calls just work.
 */

const isDev = !app.isPackaged;
const SERVER_PORT = 47615; // fixed local port for the embedded Abby server
let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function resourcePath(...parts: string[]): string {
  // In production resources live under process.resourcesPath; in dev under repo.
  const base = app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", "..");
  return path.join(base, ...parts);
}

function userDataDir(): string {
  const dir = path.join(app.getPath("userData"), "abby-data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Start the bundled Express + LLM server as a Node child process. */
function startServer(): Promise<void> {
  if (isDev) return Promise.resolve(); // dev uses the Vite + api-server workflows

  const serverEntry = resourcePath("server", "index.mjs");
  const publicDir = resourcePath("public");

  serverProcess = fork(serverEntry, [], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      NODE_ENV: "production",
      ABBY_DESKTOP: "1",
      ABBY_DATA_DIR: userDataDir(),
      ABBY_PUBLIC_DIR: publicDir,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout?.on("data", (d) => console.log(`[abby-server] ${d}`));
  serverProcess.stderr?.on("data", (d) => console.error(`[abby-server] ${d}`));

  return waitForServer(SERVER_PORT, 20000);
}

function waitForServer(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/api/healthz", timeout: 1000 },
        (res) => {
          res.destroy();
          resolve();
        },
      );
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Server did not start"));
        else setTimeout(ping, 300);
      });
    };
    ping();
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b1020",
    title: "Abby LLM",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // External links open in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    const devUrl = process.env["ABBY_DEV_URL"] ?? "http://localhost:5173";
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}/`);
  }
}

// ---- IPC: native capabilities exposed to the renderer via preload ----

ipcMain.handle("abby:getVersion", () => app.getVersion());

ipcMain.handle("abby:getDataDir", () => userDataDir());

// Let the user pick a folder of training data (e.g. their 67TB drive path).
ipcMain.handle("abby:pickFolder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Выберите папку с данными для обучения Abby",
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Pick individual files for upload.
ipcMain.handle("abby:pickFiles", async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Выберите файлы для обучения Abby",
    properties: ["openFile", "multiSelections"],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("abby:openExternal", (_e, url: string) =>
  shell.openExternal(url),
);

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error("Failed to start Abby server:", err);
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  serverProcess?.kill();
});

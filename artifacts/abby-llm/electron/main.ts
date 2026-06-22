import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

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

// ---- Нейронная модель -------------------------------------------------------

const MODEL_FILENAME = "qwen2.5-7b-q4_k_m.gguf";
// Цельный файл Q4_K_M (~4.68 ГБ). В официальном репозитории Qwen эта квантизация
// разбита на части, поэтому берём single-file сборку bartowski.
const MODEL_URL =
  "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf";

let downloadActive = false;
let downloadRequest: ReturnType<typeof https.get> | null = null;

// Синглтон сессии node-llama-cpp (загружается в память при первом вызове load)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let neuralSession: any = null;
let neuralLoading = false;

// ---- Вспомогательные функции ------------------------------------------------

function resourcePath(...parts: string[]): string {
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

function modelPath(): string {
  return path.join(userDataDir(), "models", MODEL_FILENAME);
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
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

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

// ---- Скачивание файла с прогрессом -----------------------------------------

function downloadFile(
  url: string,
  dest: string,
  onProgress: (data: {
    downloaded: number;
    total: number;
    speed: number;
    percent: number;
  }) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doGet = (u: string, redirects = 0) => {
      if (redirects > 10) {
        reject(new Error("Слишком много редиректов"));
        return;
      }
      const req = https.get(
        u,
        { headers: { "User-Agent": "Abby-LLM-Downloader/1.0" } },
        (res) => {
          // Следуем редиректам (HuggingFace → CDN)
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.destroy();
            doGet(res.headers.location, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode ?? "unknown"}`));
            return;
          }

          const total = parseInt(res.headers["content-length"] ?? "0", 10);
          let downloaded = 0;
          let lastReportTime = Date.now();
          let lastBytes = 0;

          const file = fs.createWriteStream(dest);

          res.on("data", (chunk: Buffer) => {
            downloaded += chunk.length;
            const now = Date.now();
            if (now - lastReportTime >= 400) {
              const elapsed = (now - lastReportTime) / 1000;
              const speed = (downloaded - lastBytes) / elapsed;
              onProgress({
                downloaded,
                total,
                speed,
                percent: total > 0 ? (downloaded / total) * 100 : 0,
              });
              lastReportTime = now;
              lastBytes = downloaded;
            }
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close(() => resolve());
          });
          file.on("error", (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
          res.on("error", (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        },
      );

      downloadRequest = req;
      req.on("error", reject);
    };

    doGet(url);
  });
}

// ---- IPC: нативные возможности -----------------------------------------------

ipcMain.handle("abby:getVersion", () => app.getVersion());

ipcMain.handle("abby:getDataDir", () => userDataDir());

ipcMain.handle("abby:pickFolder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Выберите папку с данными для обучения Abby",
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

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

// ---- IPC: нейронная модель ---------------------------------------------------

/** Возвращает статус модели (файл на диске). */
ipcMain.handle("abby:model:status", () => {
  const mp = modelPath();
  const exists = fs.existsSync(mp);
  return {
    exists,
    path: mp,
    size: exists ? fs.statSync(mp).size : 0,
    filename: MODEL_FILENAME,
    loaded: neuralSession !== null,
  };
});

/** Скачивает модель с HuggingFace с прогрессом. */
ipcMain.handle("abby:model:download", async () => {
  if (downloadActive) {
    return { error: "Загрузка уже выполняется" };
  }
  downloadActive = true;

  const modelsDir = path.join(userDataDir(), "models");
  fs.mkdirSync(modelsDir, { recursive: true });

  const tmpPath = modelPath() + ".tmp";
  const destPath = modelPath();

  const sendProgress = (data: {
    downloaded: number;
    total: number;
    speed: number;
    percent: number;
  }) => {
    mainWindow?.webContents.send("abby:model:progress", data);
  };

  try {
    await downloadFile(MODEL_URL, tmpPath, sendProgress);
    fs.renameSync(tmpPath, destPath);
    downloadActive = false;
    downloadRequest = null;
    // Финальный прогресс
    const size = fs.statSync(destPath).size;
    sendProgress({ downloaded: size, total: size, speed: 0, percent: 100 });
    return { success: true };
  } catch (err) {
    downloadActive = false;
    downloadRequest = null;
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
    return { error: String(err) };
  }
});

/** Отменяет скачивание модели. */
ipcMain.handle("abby:model:cancel", () => {
  if (downloadRequest) {
    downloadRequest.destroy();
    downloadRequest = null;
  }
  downloadActive = false;
  const tmpPath = modelPath() + ".tmp";
  if (fs.existsSync(tmpPath)) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

/** Загружает модель в память (node-llama-cpp). */
ipcMain.handle("abby:neural:load", async () => {
  if (neuralSession) return { success: true, alreadyLoaded: true };
  if (neuralLoading) return { error: "Уже загружается" };

  const mp = modelPath();
  if (!fs.existsSync(mp)) {
    return { error: "Файл модели не найден. Сначала установите модель." };
  }

  neuralLoading = true;
  mainWindow?.webContents.send("abby:neural:status", { loading: true });

  try {
    // Динамический импорт — graceful fallback если node-llama-cpp недоступен
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("node-llama-cpp") as any;
    const llama = await mod.getLlama();
    const model = await llama.loadModel({ modelPath: mp });
    const context = await model.createContext({ contextSize: 4096 });
    neuralSession = new mod.LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt:
        "Ты — Abby, умный ИИ-ассистент. Если вопрос задан на русском — отвечай на русском. Ты помогаешь с кодом, вопросами и задачами.",
    });
    neuralLoading = false;
    mainWindow?.webContents.send("abby:neural:status", { loading: false, loaded: true });
    return { success: true };
  } catch (err) {
    neuralLoading = false;
    neuralSession = null;
    mainWindow?.webContents.send("abby:neural:status", { loading: false, loaded: false });
    return { error: `Не удалось загрузить модель: ${String(err)}` };
  }
});

/** Выгружает модель из памяти. */
ipcMain.handle("abby:neural:unload", () => {
  neuralSession = null;
  mainWindow?.webContents.send("abby:neural:status", { loading: false, loaded: false });
  return { success: true };
});

/** Генерирует ответ от Qwen 2.5 7B. */
ipcMain.handle("abby:neural:chat", async (_e, message: string) => {
  if (!neuralSession) {
    return { error: "Нейронная модель не загружена" };
  }
  try {
    const response: string = await neuralSession.prompt(message);
    return { response };
  } catch (err) {
    return { error: String(err) };
  }
});

// ---- IPC: управление окном --------------------------------------------------

ipcMain.handle("abby:window:minimize", () => mainWindow?.minimize());

ipcMain.handle("abby:window:toggleMaximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle("abby:window:close", () => mainWindow?.close());

// ---- Жизненный цикл ---------------------------------------------------------

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

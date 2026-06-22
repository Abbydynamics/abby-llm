import { contextBridge, ipcRenderer } from "electron";

/**
 * Secure bridge between the sandboxed renderer and the Node main process.
 * Only these typed methods are exposed — no raw ipcRenderer, no Node globals.
 */

export interface ModelProgress {
  downloaded: number; // байт
  total: number;      // байт
  speed: number;      // байт/сек
  percent: number;    // 0–100
}

export interface ModelStatus {
  exists: boolean;
  path: string;
  size: number;
  filename: string;
  loaded: boolean;
}

export interface NeuralStatusEvent {
  loading: boolean;
  loaded?: boolean;
}

const abbyApi = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("abby:getVersion"),
  getDataDir: (): Promise<string> => ipcRenderer.invoke("abby:getDataDir"),
  pickFolder: (): Promise<string | null> =>
    ipcRenderer.invoke("abby:pickFolder"),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke("abby:pickFiles"),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("abby:openExternal", url),
  minimizeWindow: (): Promise<void> =>
    ipcRenderer.invoke("abby:window:minimize"),
  toggleMaximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke("abby:window:toggleMaximize"),
  closeWindow: (): Promise<void> => ipcRenderer.invoke("abby:window:close"),

  // ---- Нейронная модель ----

  /** Возвращает наличие и размер файла модели на диске. */
  getModelStatus: (): Promise<ModelStatus> =>
    ipcRenderer.invoke("abby:model:status"),

  /** Запускает скачивание модели с HuggingFace. Прогресс приходит через onModelProgress. */
  downloadModel: (): Promise<{ success?: boolean; error?: string }> =>
    ipcRenderer.invoke("abby:model:download"),

  /** Отменяет текущую загрузку. */
  cancelDownload: (): Promise<void> =>
    ipcRenderer.invoke("abby:model:cancel"),

  /** Загружает модель в RAM (node-llama-cpp). */
  loadNeuralModel: (): Promise<{ success?: boolean; alreadyLoaded?: boolean; error?: string }> =>
    ipcRenderer.invoke("abby:neural:load"),

  /** Выгружает модель из RAM. */
  unloadNeuralModel: (): Promise<{ success?: boolean }> =>
    ipcRenderer.invoke("abby:neural:unload"),

  /** Отправляет сообщение нейронной модели и получает ответ. */
  neuralChat: (message: string): Promise<{ response?: string; error?: string }> =>
    ipcRenderer.invoke("abby:neural:chat", message),

  /** Подписывается на прогресс загрузки. Возвращает функцию отписки. */
  onModelProgress: (
    callback: (data: ModelProgress) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: ModelProgress,
    ) => callback(data);
    ipcRenderer.on("abby:model:progress", handler);
    return () => ipcRenderer.removeListener("abby:model:progress", handler);
  },

  /** Подписывается на изменения статуса нейронного движка. Возвращает функцию отписки. */
  onNeuralStatus: (
    callback: (data: NeuralStatusEvent) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: NeuralStatusEvent,
    ) => callback(data);
    ipcRenderer.on("abby:neural:status", handler);
    return () => ipcRenderer.removeListener("abby:neural:status", handler);
  },

  isDesktop: true as const,
};

contextBridge.exposeInMainWorld("abby", abbyApi);

export type AbbyDesktopApi = typeof abbyApi;

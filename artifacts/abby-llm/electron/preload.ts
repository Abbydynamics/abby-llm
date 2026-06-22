import { contextBridge, ipcRenderer } from "electron";

/**
 * Secure bridge between the sandboxed renderer and the Node main process.
 * Only these typed methods are exposed — no raw ipcRenderer, no Node globals.
 */
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
  isDesktop: true as const,
};

contextBridge.exposeInMainWorld("abby", abbyApi);

export type AbbyDesktopApi = typeof abbyApi;

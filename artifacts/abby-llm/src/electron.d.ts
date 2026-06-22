/**
 * Types for the desktop bridge exposed by electron/preload.ts.
 * `window.abby` is only present when running inside the Electron app.
 */

export interface ModelProgress {
  downloaded: number;
  total: number;
  speed: number;
  percent: number;
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

export interface AbbyDesktopApi {
  getVersion: () => Promise<string>;
  getDataDir: () => Promise<string>;
  pickFolder: () => Promise<string | null>;
  pickFiles: () => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isDesktop: true;

  // Нейронная модель
  getModelStatus: () => Promise<ModelStatus>;
  downloadModel: () => Promise<{ success?: boolean; error?: string }>;
  cancelDownload: () => Promise<void>;
  loadNeuralModel: () => Promise<{ success?: boolean; alreadyLoaded?: boolean; error?: string }>;
  unloadNeuralModel: () => Promise<{ success?: boolean }>;
  neuralChat: (message: string) => Promise<{ response?: string; error?: string }>;
  onModelProgress: (callback: (data: ModelProgress) => void) => () => void;
  onNeuralStatus: (callback: (data: NeuralStatusEvent) => void) => () => void;
}

declare global {
  interface Window {
    abby?: AbbyDesktopApi;
  }
}

export {};

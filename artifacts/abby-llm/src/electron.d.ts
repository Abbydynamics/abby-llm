/**
 * Types for the desktop bridge exposed by electron/preload.ts.
 * `window.abby` is only present when running inside the Electron app.
 */
export interface AbbyDesktopApi {
  getVersion: () => Promise<string>;
  getDataDir: () => Promise<string>;
  pickFolder: () => Promise<string | null>;
  pickFiles: () => Promise<string[]>;
  openExternal: (url: string) => Promise<void>;
  isDesktop: true;
}

declare global {
  interface Window {
    abby?: AbbyDesktopApi;
  }
}

export {};

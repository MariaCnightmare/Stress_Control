/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      getConfig: () => Promise<{
        showDynamic: boolean;
        showStatic: boolean;
        clickThrough: boolean;
      }>;
      setConfig: (cfg: {
        showDynamic?: boolean;
        showStatic?: boolean;
        clickThrough?: boolean;
      }) => Promise<void>;
      readLatestReport: () => Promise<any | null>;
      getAppInfo: () => Promise<{
        stressControlVersion: string | null;
        uiVersion: string | null;
      }>;
      onConfigUpdated: (cb: (cfg: {
        showDynamic: boolean;
        showStatic: boolean;
        clickThrough: boolean;
      }) => void) => () => void;
    };
  }
}

export {};

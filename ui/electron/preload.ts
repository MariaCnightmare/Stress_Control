import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (cfg: { showDynamic?: boolean; showStatic?: boolean; clickThrough?: boolean }) =>
    ipcRenderer.invoke("set-config", cfg),
  readLatestReport: () => ipcRenderer.invoke("read-report"),
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  onConfigUpdated: (cb: (cfg: { showDynamic: boolean; showStatic: boolean; clickThrough: boolean }) => void) => {
    const handler = (_event: unknown, cfg: { showDynamic: boolean; showStatic: boolean; clickThrough: boolean }) => cb(cfg);
    ipcRenderer.on("config-updated", handler);
    return () => ipcRenderer.removeListener("config-updated", handler);
  }
});

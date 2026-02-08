import { app, BrowserWindow, Menu, Tray, globalShortcut, nativeImage, ipcMain, screen } from "electron";
import path from "node:path";
import fs from "node:fs";

type UiConfig = {
  showDynamic: boolean;
  showStatic: boolean;
  clickThrough: boolean;
};

const DEFAULT_CONFIG: UiConfig = {
  showDynamic: true,
  showStatic: true,
  clickThrough: true
};

const isDev = !!process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === "development";
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function appRoot() {
  return app.getAppPath();
}

function configPath() {
  return path.resolve(appRoot(), "config.json");
}

function reportPath() {
  if (process.env.STRESS_REPORT_PATH) {
    return path.resolve(process.env.STRESS_REPORT_PATH);
  }
  return path.resolve(appRoot(), "..", "reports", "latest.json");
}

function loadConfig(): UiConfig {
  try {
    const raw = fs.readFileSync(configPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed
    } as UiConfig;
  } catch (err) {
    try {
      fs.writeFileSync(configPath(), JSON.stringify(DEFAULT_CONFIG, null, 2));
    } catch {
      // ignore write errors
    }
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg: UiConfig) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch {
    // ignore write errors
  }
}

function applyClickThrough(win: BrowserWindow, enabled: boolean) {
  win.setIgnoreMouseEvents(enabled, { forward: true });
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;

  const preloadPath = fs.existsSync(path.join(appRoot(), "dist", "electron", "preload.js"))
    ? path.join(appRoot(), "dist", "electron", "preload.js")
    : path.join(appRoot(), "electron", "preload.ts");

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const cfg = loadConfig();
  applyClickThrough(mainWindow, cfg.clickThrough);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(appRoot(), "dist", "renderer", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function updateConfig(partial: Partial<UiConfig>) {
  const current = loadConfig();
  const next = { ...current, ...partial };
  saveConfig(next);
  if (mainWindow) {
    applyClickThrough(mainWindow, next.clickThrough);
    mainWindow.webContents.send("config-updated", next);
  }
  refreshTray(next);
}

function refreshTray(cfg: UiConfig) {
  if (!tray) return;
  const template = [
    { label: "Dynamic HUD", type: "checkbox", checked: cfg.showDynamic, click: (item: any) => updateConfig({ showDynamic: item.checked }) },
    { label: "Static HUD", type: "checkbox", checked: cfg.showStatic, click: (item: any) => updateConfig({ showStatic: item.checked }) },
    { label: "Click Through", type: "checkbox", checked: cfg.clickThrough, click: (item: any) => updateConfig({ clickThrough: item.checked }) },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function buildTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAhklEQVR42mP8z8AARcNAGCgDo5h/0GShADmG/5FhZgZGBgYxQ8JgH7wBQNQKpGJgg+0mWQjGgKk1KDYJpIFM+YFhe0g4BfE1FzVxD6h3m9qzKOGQkYGRgWg3D8S0E9h+L0G0og7ACiXMM3MWe56AAAAAElFTkSuQmCC"
  );
  tray = new Tray(icon);
  tray.setToolTip("Stress Control HUD");
  refreshTray(loadConfig());
}

function registerHotkeys() {
  globalShortcut.register("Ctrl+Alt+1", () => {
    const cfg = loadConfig();
    updateConfig({ showDynamic: !cfg.showDynamic });
  });
  globalShortcut.register("Ctrl+Alt+2", () => {
    const cfg = loadConfig();
    updateConfig({ showStatic: !cfg.showStatic });
  });
  globalShortcut.register("Ctrl+Alt+0", () => {
    const cfg = loadConfig();
    updateConfig({ clickThrough: !cfg.clickThrough });
  });
}

function getStressControlVersion(): string | null {
  try {
    const pyproject = fs.readFileSync(path.resolve(appRoot(), "..", "pyproject.toml"), "utf-8");
    const match = pyproject.match(/version\s*=\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getUiVersion(): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(appRoot(), "package.json"), "utf-8"));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

function registerIpc() {
  ipcMain.handle("get-config", () => loadConfig());
  ipcMain.handle("set-config", (_event, partial: Partial<UiConfig>) => updateConfig(partial));
  ipcMain.handle("read-report", () => {
    try {
      const raw = fs.readFileSync(reportPath(), "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  ipcMain.handle("get-app-info", () => ({
    stressControlVersion: getStressControlVersion(),
    uiVersion: getUiVersion()
  }));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  buildTray();
  registerHotkeys();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

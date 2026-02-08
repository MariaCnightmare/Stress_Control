import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  nativeImage,
  ipcMain,
  screen,
  type MenuItem,
  type MenuItemConstructorOptions,
  type Event
} from "electron";
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

type DebugWindowOptions = {
  enabled: boolean;
  transparent: boolean;
  backgroundColor: string;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  frame: boolean;
  resizable: boolean;
  openDevTools: boolean;
};

function log(message: string, data?: Record<string, unknown>) {
  const prefix = `[main ${new Date().toISOString()}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

function parseBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return defaultValue;
}

function getDebugOptions(): DebugWindowOptions {
  const enabled = isDev && parseBool(process.env.HUD_DEBUG, true);
  const transparent = enabled ? parseBool(process.env.HUD_DEBUG_TRANSPARENT, false) : true;
  const backgroundColor = enabled ? (process.env.HUD_DEBUG_BG ?? "#000000D9") : "#00000000";
  return {
    enabled,
    transparent,
    backgroundColor,
    alwaysOnTop: enabled ? parseBool(process.env.HUD_DEBUG_ALWAYS_ON_TOP, true) : true,
    skipTaskbar: enabled ? parseBool(process.env.HUD_DEBUG_SKIP_TASKBAR, false) : true,
    frame: enabled ? parseBool(process.env.HUD_DEBUG_FRAME, true) : false,
    resizable: enabled ? parseBool(process.env.HUD_DEBUG_RESIZABLE, true) : false,
    openDevTools: enabled ? parseBool(process.env.HUD_DEBUG_DEVTOOLS, false) : false
  };
}

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

function moveToPrimaryWorkArea(win: BrowserWindow) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  win.setBounds({ x, y, width, height });
}

async function loadRenderer(win: BrowserWindow) {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const indexPath = path.join(appRoot(), "dist", "renderer", "index.html");
  log("Renderer targets", { devUrl, indexPath });

  if (isDev && devUrl) {
    try {
      await win.loadURL(devUrl);
      return;
    } catch (err) {
      log("loadURL failed, falling back to loadFile", { error: String(err) });
    }
  }

  if (fs.existsSync(indexPath)) {
    try {
      await win.loadFile(indexPath);
      return;
    } catch (err) {
      log("loadFile failed, falling back to data URL", { error: String(err) });
    }
  } else {
    log("index.html missing, falling back to data URL");
  }

  const fallbackHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Stress Control HUD (Fallback)</title>
        <style>
          html, body { margin: 0; padding: 0; background: #111; color: #eee; font-family: Segoe UI, Arial, sans-serif; }
          .wrap { padding: 24px; }
          h1 { margin: 0 0 12px; font-size: 20px; }
          p { margin: 8px 0; line-height: 1.4; }
          code { background: #222; padding: 2px 6px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>HUD fallback page</h1>
          <p>Renderer failed to load. Check the main process logs for details.</p>
          <p>Dev URL: <code>${devUrl ?? "not set"}</code></p>
          <p>Index path: <code>${indexPath}</code></p>
        </div>
      </body>
    </html>
  `.trim();

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
}

function attachDebugLogging(win: BrowserWindow) {
  win.on("ready-to-show", () => log("window ready-to-show"));
  win.on("show", () => log("window show"));
  win.on("focus", () => log("window focus"));
  win.on("unresponsive", () => log("window unresponsive"));
  win.on("render-process-gone", (_event, details) => log("render-process-gone", details as unknown as Record<string, unknown>));
  win.webContents.on("did-finish-load", () => log("webContents did-finish-load"));
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    log("webContents did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("renderer console", { level, message, line, sourceId });
  });
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;
  const debug = getDebugOptions();

  const preloadPath = fs.existsSync(path.join(appRoot(), "dist", "electron", "preload.js"))
    ? path.join(appRoot(), "dist", "electron", "preload.js")
    : path.join(appRoot(), "electron", "preload.ts");

  log("App paths", {
    appRoot: appRoot(),
    configPath: configPath(),
    reportPath: reportPath(),
    preloadPath
  });
  log("Debug window options", debug);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: debug.transparent,
    frame: debug.frame,
    resizable: debug.resizable,
    alwaysOnTop: debug.alwaysOnTop,
    fullscreenable: false,
    skipTaskbar: debug.skipTaskbar,
    hasShadow: false,
    backgroundColor: debug.backgroundColor,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  attachDebugLogging(mainWindow);

  const cfg = loadConfig();
  applyClickThrough(mainWindow, debug.enabled ? false : cfg.clickThrough);

  mainWindow.once("ready-to-show", () => {
    moveToPrimaryWorkArea(mainWindow!);
    mainWindow!.show();
    mainWindow!.focus();
  });

  void loadRenderer(mainWindow);
  moveToPrimaryWorkArea(mainWindow);
  mainWindow.show();
  mainWindow.focus();

  if (debug.openDevTools) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
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
  const template: MenuItemConstructorOptions[] = [
    { label: "Dynamic HUD", type: "checkbox", checked: cfg.showDynamic, click: (item: MenuItem) => updateConfig({ showDynamic: item.checked }) },
    { label: "Static HUD", type: "checkbox", checked: cfg.showStatic, click: (item: MenuItem) => updateConfig({ showStatic: item.checked }) },
    { label: "Click Through", type: "checkbox", checked: cfg.clickThrough, click: (item: MenuItem) => updateConfig({ clickThrough: item.checked }) },
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

app.on("window-all-closed", (event: Event) => {
  event.preventDefault();
});

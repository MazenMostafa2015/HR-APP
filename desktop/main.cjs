const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const DEFAULT_SERVER_URL = "http://elms-server:3000";
let mainWindow;

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function normalizeServerUrl(value) {
  const url = new URL(String(value).trim());
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("The server URL must start with http:// or https://.");
  return url.toString().replace(/\/$/, "");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(serverUrl) {
  const normalized = normalizeServerUrl(serverUrl);
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ serverUrl: normalized }, null, 2), "utf8");
  return normalized;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "ELMS · Leave Operations",
    backgroundColor: "#f5f7f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const config = readConfig();
  if (config.serverUrl) {
    try {
      mainWindow.loadURL(normalizeServerUrl(config.serverUrl));
      return;
    } catch {
      // Fall through to the setup screen when the saved URL is invalid.
    }
  }
  mainWindow.loadFile(path.join(__dirname, "setup.html"));
}

ipcMain.handle("elms:get-config", () => ({ serverUrl: readConfig().serverUrl || DEFAULT_SERVER_URL }));
ipcMain.handle("elms:save-config", (_event, serverUrl) => {
  try {
    const normalized = saveConfig(serverUrl);
    mainWindow.loadURL(normalized);
    return { ok: true, serverUrl: normalized };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid server URL" };
  }
});
ipcMain.handle("elms:change-server", () => {
  mainWindow.loadFile(path.join(__dirname, "setup.html"));
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

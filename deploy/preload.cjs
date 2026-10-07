const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("elmsDesktop", {
  getConfig: () => ipcRenderer.invoke("elms:get-config"),
  saveConfig: (serverUrl) => ipcRenderer.invoke("elms:save-config", serverUrl),
  changeServer: () => ipcRenderer.invoke("elms:change-server"),
});

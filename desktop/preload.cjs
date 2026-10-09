const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("elmsDesktop", {
  getConfig: () => ipcRenderer.invoke("elms:get-config"),
  saveConfig: (payload) => ipcRenderer.invoke("elms:save-config", payload),
  saveLanguage: (language) => ipcRenderer.invoke("elms:save-language", language),
  changeServer: () => ipcRenderer.invoke("elms:change-server"),
});

window.addEventListener("DOMContentLoaded", async () => {
  const config = await ipcRenderer.invoke("elms:get-config");
  const language = config.language === "ar" ? "ar" : "en";
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem("elms-language", language); } catch {}
});

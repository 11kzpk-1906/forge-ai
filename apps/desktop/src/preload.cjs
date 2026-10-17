const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Set();
const queuedCallbacks = [];

ipcRenderer.on("forgeai:oauth-callback", (_event, callbackUrl) => {
  if (listeners.size === 0) {
    queuedCallbacks.push(callbackUrl);
    return;
  }
  for (const listener of listeners) listener(callbackUrl);
});

contextBridge.exposeInMainWorld("forgeAI", {
  isDesktop: true,
  openOAuthUrl: (url) => ipcRenderer.invoke("forgeai:open-oauth-url", url),
  onOAuthCallback: (listener) => {
    listeners.add(listener);
    while (queuedCallbacks.length) listener(queuedCallbacks.shift());
    return () => listeners.delete(listener);
  },
});

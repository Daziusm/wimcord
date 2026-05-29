const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wimcordInstaller", {
    run: (action, options) => ipcRenderer.invoke("wimcord-installer-run", action, options),
    build: () => ipcRenderer.invoke("wimcord-installer-build"),
    restartDiscord: options => ipcRenderer.invoke("wimcord-installer-restart-discord", options),
    listDiscords: () => ipcRenderer.invoke("wimcord-installer-list-discords"),
    browseDiscord: () => ipcRenderer.invoke("wimcord-installer-browse-discord"),
    validateDiscord: dir => ipcRenderer.invoke("wimcord-installer-validate-discord", dir),
    openLogs: () => ipcRenderer.invoke("wimcord-log-open"),
    clearLogs: () => ipcRenderer.invoke("wimcord-log-clear"),
    closeDiscord: options => ipcRenderer.invoke("wimcord-installer-close-discord", options),
    readLastResult: () => ipcRenderer.invoke("wimcord-installer-read-result"),
    clearLastResult: () => ipcRenderer.invoke("wimcord-installer-clear-result"),
    getInfo: () => ipcRenderer.invoke("wimcord-installer-get-info"),
    onProgress: callback => {
        const handler = (_e, data) => callback(data);
        ipcRenderer.on("wimcord-installer-progress", handler);
        return () => ipcRenderer.removeListener("wimcord-installer-progress", handler);
    },
});

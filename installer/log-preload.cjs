const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("logView", {
    clear: () => ipcRenderer.invoke("wimcord-log-clear"),
    onAppend: callback => {
        const handler = (_e, text) => callback(text);
        ipcRenderer.on("log-append", handler);
        return () => ipcRenderer.removeListener("log-append", handler);
    },
    onClear: callback => {
        const handler = () => callback();
        ipcRenderer.on("log-clear", handler);
        return () => ipcRenderer.removeListener("log-clear", handler);
    },
});

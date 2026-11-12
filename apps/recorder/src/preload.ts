import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("recorderAPI", {
  getConfig: () => ipcRenderer.invoke("recorder:getConfig"),
  saveConfig: (config: unknown) => ipcRenderer.invoke("recorder:saveConfig", config),
  getEnvironment: () => ipcRenderer.invoke("recorder:getEnvironment"),
  getStatus: () => ipcRenderer.invoke("recorder:getStatus"),
  startRecording: (payload: { employeeIdentifier: string }) => ipcRenderer.invoke("recorder:startRecording", payload),
  pauseRecording: () => ipcRenderer.invoke("recorder:pauseRecording"),
  stopRecording: () => ipcRenderer.invoke("recorder:stopRecording"),
  openSettings: () => ipcRenderer.invoke("recorder:openSettings"),
  openDiagnostics: () => ipcRenderer.invoke("recorder:openDiagnostics"),
  onStatusUpdate: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on("recorder:status", listener);
    return () => ipcRenderer.removeListener("recorder:status", listener);
  },
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("recorder:open-settings", listener);
    return () => ipcRenderer.removeListener("recorder:open-settings", listener);
  },
  onOpenDiagnostics: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("recorder:open-diagnostics", listener);
    return () => ipcRenderer.removeListener("recorder:open-diagnostics", listener);
  },
  onConfigUpdated: (callback: (config: unknown) => void) => {
    const listener = (_event: unknown, config: unknown) => callback(config);
    ipcRenderer.on("recorder:config-updated", listener);
    return () => ipcRenderer.removeListener("recorder:config-updated", listener);
  },
});

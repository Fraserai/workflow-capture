import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("recorderAPI", {
  getConfig: () => ipcRenderer.invoke("recorder:getConfig"),
  saveConfig: (config: unknown) => ipcRenderer.invoke("recorder:saveConfig", config),
  getEnvironment: () => ipcRenderer.invoke("recorder:getEnvironment"),
  getStatus: () => ipcRenderer.invoke("recorder:getStatus"),
  startRecording: (payload: { employeeIdentifier: string }) =>
    ipcRenderer.invoke("recorder:startRecording", payload),
  pauseRecording: () => ipcRenderer.invoke("recorder:pauseRecording"),
  stopRecording: () => ipcRenderer.invoke("recorder:stopRecording"),
  toggleSettings: () => ipcRenderer.invoke("recorder:toggleSettings"),
  onStatusUpdate: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on("recorder:status", listener);
    return () => ipcRenderer.removeListener("recorder:status", listener);
  },
  onToggleSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("recorder:toggle-settings", listener);
    return () => ipcRenderer.removeListener("recorder:toggle-settings", listener);
  },
});

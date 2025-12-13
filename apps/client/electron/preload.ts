import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ct", {
  storeGet: (key: string, fallback: any = null) => ipcRenderer.invoke("store:get", key, fallback),
  storeSet: (key: string, value: any) => ipcRenderer.invoke("store:set", key, value),
  storeDelete: (key: string) => ipcRenderer.invoke("store:delete", key),
  getPath: (name: string) => ipcRenderer.invoke("app:getPath", name),
});

export {};

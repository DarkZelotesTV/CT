import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ct", {
  storeGet: (key: string, fallback: any = null) => ipcRenderer.invoke("store:get", key, fallback),
  storeSet: (key: string, value: any) => ipcRenderer.invoke("store:set", key, value),
  storeDelete: (key: string) => ipcRenderer.invoke("store:delete", key),
  getPath: (name: string) => ipcRenderer.invoke("app:getPath", name),
  openChatWindow: (chatId: string | number, chatName: string) =>
    ipcRenderer.invoke("chat:openWindow", chatId, chatName),
  dockChatWindow: (chatId: string | number, chatName: string) =>
    ipcRenderer.invoke("chat:dockWindow", chatId, chatName),
  onChatDocked: (callback: (chatId: number, chatName: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, chatId: number, chatName: string) =>
      callback(chatId, chatName);

    ipcRenderer.on("chat:docked", listener);
    return () => ipcRenderer.removeListener("chat:docked", listener);
  },
  getScreenSources: () => ipcRenderer.invoke("media:getSources"),
});

export {};
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // ... deine alten Funktionen ...
  saveMessage: (content: string) => ipcRenderer.invoke('db:save-message', content),
  getMessages: () => ipcRenderer.invoke('db:get-messages'),
  openChatWindow: (chatId: string | number, chatName: string) => ipcRenderer.invoke('win:open-chat', chatId, chatName),

  // --- NEU ---
  dockChatWindow: (chatId: string | number, chatName: string) => ipcRenderer.invoke('win:dock-chat', chatId, chatName),
  
  // Listener: Das Hauptfenster hört hier zu.
  // Wir filtern das Electron-Event-Objekt (_event) raus und geben nur die Daten weiter.
  onChatDocked: (callback: (chatId: number, chatName: string) => void) => {
    ipcRenderer.on('chat-docked-back', (_event, chatId, chatName) => callback(chatId, chatName));
  }
});
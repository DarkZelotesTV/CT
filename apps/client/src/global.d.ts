declare global {
  interface Window {
    electron: {
      saveMessage: (content: string) => Promise<number>;
      getMessages: () => Promise<any[]>;
      openChatWindow: (chatId: string | number, chatName: string) => Promise<void>;
      
      // --- NEU ---
      // Befehl vom Popout-Fenster: "Dock mich an"
      dockChatWindow: (chatId: string | number, chatName: string) => Promise<void>;
      // Event-Listener für das Hauptfenster: "Ein Chat kommt zurück"
      onChatDocked: (callback: (chatId: number, chatName: string) => void) => void;
    };
  }
}
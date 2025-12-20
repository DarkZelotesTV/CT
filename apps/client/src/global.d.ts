declare global {
  interface Window {
    ct?: {
      storeGet: <T = unknown>(key: string, fallback?: T | null) => Promise<T>;
      storeSet: <T = unknown>(key: string, value: T) => Promise<void>;
      storeDelete: (key: string) => Promise<void>;
      getPath: (name: string) => Promise<string>;
      openChatWindow: (chatId: string | number, chatName: string) => Promise<void>;
      dockChatWindow: (chatId: string | number, chatName: string) => Promise<void>;
      onChatDocked: (callback: (chatId: number, chatName: string) => void) => () => void;
      getScreenSources: () => Promise<import("electron").DesktopCapturerSource[]>;
      windowControls?: {
        getState: () => Promise<{ isMaximized: boolean; isFullScreen: boolean; platform: string; titlebarHeight: number }>;
        minimize: () => Promise<boolean>;
        toggleMaximize: () => Promise<boolean>;
        close: () => Promise<boolean>;
        onStateChange: (
          callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void
        ) => () => void;
      };
    };
    clover?: {
      filterSystemAudioTrack?: (track: MediaStreamTrack) => MediaStreamTrack | null | undefined;
    };
  }
}

export {};

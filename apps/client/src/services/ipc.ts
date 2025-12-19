interface IpcLike {
  send: (channel: string, payload?: unknown) => void;
  on: (channel: string, listener: (...args: any[]) => void) => void;
}

const getRenderer = (): IpcLike | null => {
  const anyWindow = window as typeof window & { electron?: { ipcRenderer?: IpcLike } };
  return anyWindow?.electron?.ipcRenderer ?? null;
};

const fallback: IpcLike = {
  send: (channel: string, payload?: unknown) => {
    console.warn(`[ipc] Renderer unavailable, attempted to send on ${channel}`, payload);
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    console.warn(`[ipc] Renderer unavailable, attempted to register listener for ${channel}`);
    // Provide a basic cleanup function so callers can still unsubscribe cleanly.
    return () => {
      void listener;
    };
  },
};

export const ipcClient: IpcLike = getRenderer() ?? fallback;

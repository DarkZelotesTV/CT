import { app, BrowserWindow, ipcMain, shell, desktopCapturer } from "electron";
import path from "path";
import fs from "fs";

const isDev = !app.isPackaged;

// Bei Vite+Electron wird das oft gesetzt, ansonsten fallback:
const DEV_SERVER_URL =
  process.env.VITE_DEV_SERVER_URL ||
  process.env.ELECTRON_RENDERER_URL ||
  "http://localhost:5173/";

const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

// Renderer dist liegt typischerweise eine Ebene über dist-electron.
const RENDERER_DIST = path.join(__dirname, "..", "dist");
const INDEX_HTML = path.join(RENDERER_DIST, "index.html");

let mainWindow: BrowserWindow | null = null;
const chatWindows = new Map<string, BrowserWindow>();

/**
 * Simple JSON Store als Ersatz für SQLite (Settings/Cache).
 * Liegt unter: %APPDATA%/<AppName>/local-store.json
 */
const STORE_PATH = (() => {
  try {
    return path.join(app.getPath("userData"), "local-store.json");
  } catch {
    return path.join(__dirname, "local-store.json");
  }
})();

function readStore(): Record<string, any> {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, any>) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("[store] write failed:", e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#050507",
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // FIX: Screen Share Handler für direkte Browser-Anfragen (als Fallback)
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Wählt automatisch den ersten Bildschirm, wenn kein Custom UI genutzt wird
      const [firstSource] = sources;
      if (firstSource) {
        callback({ video: firstSource } as unknown as Electron.Streams);
      } else {
        callback({} as Electron.Streams);
      }
    }).catch(() => {
      callback({} as Electron.Streams);
    });
  });

  // Externe Links im Default Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isHttp = url.startsWith("http://") || url.startsWith("https://");
    const isMail = url.startsWith("mailto:");
    if ((isHttp || isMail) && !url.startsWith(DEV_SERVER_URL)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL).catch((e) => {
      console.error("[electron] failed to load dev url:", DEV_SERVER_URL, e);
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(INDEX_HTML).catch((e) => {
      console.error("[electron] failed to load index.html:", INDEX_HTML, e);
    });
  }
}

function registerIpc() {
  // JSON Store APIs (als Ersatz für SQLite)
  ipcMain.handle("store:get", async (_event, key: string, fallback: any = null) => {
    const s = readStore();
    return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : fallback;
  });

  ipcMain.handle("store:set", async (_event, key: string, value: any) => {
    const s = readStore();
    s[key] = value;
    writeStore(s);
    return true;
  });

  ipcMain.handle("store:delete", async (_event, key: string) => {
    const s = readStore();
    delete s[key];
    writeStore(s);
    return true;
  });

  ipcMain.handle("app:getPath", async (_event, name: string) => {
    try {
      return app.getPath(name as any);
    } catch {
      return null;
    }
  });

  // FIX: IPC Handler um Screen-Sources (Fenster/Bildschirme) abzurufen
  ipcMain.handle("media:getSources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 320, height: 180 },
      });
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
      }));
    } catch (error) {
      console.error("Error getting screen sources:", error);
      return [];
    }
  });

  ipcMain.handle("chat:openWindow", async (_event, chatId: string | number, chatName: string) => {
    const id = String(chatId);
    const existing = chatWindows.get(id);
    if (existing) {
      existing.focus();
      return;
    }

    const chatWindow = new BrowserWindow({
      width: 420,
      height: 640,
      minWidth: 360,
      minHeight: 480,
      title: chatName,
      backgroundColor: "#050507",
      autoHideMenuBar: true,
      webPreferences: {
        preload: PRELOAD_PATH,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    chatWindows.set(id, chatWindow);

    chatWindow.on("closed", () => {
      chatWindows.delete(id);
    });

    const hashPath = `/popout/${encodeURIComponent(id)}?name=${encodeURIComponent(chatName)}`;

    if (isDev) {
      chatWindow
        .loadURL(`${DEV_SERVER_URL}#${hashPath}`)
        .catch((e) => console.error("[electron] failed to load chat window:", e));
    } else {
      chatWindow
        .loadFile(INDEX_HTML, { hash: hashPath })
        .catch((e) => console.error("[electron] failed to load chat window:", e));
    }
  });

  ipcMain.handle("chat:dockWindow", async (event, chatId: string | number, chatName: string) => {
    const id = String(chatId);
    const target = chatWindows.get(id) || BrowserWindow.fromWebContents(event.sender);
    target?.close();
    chatWindows.delete(id);

    if (mainWindow) {
      mainWindow.webContents.send("chat:docked", Number(chatId), chatName);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
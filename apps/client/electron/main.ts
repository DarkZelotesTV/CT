import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';

// Pfad zur Datenbank (AppData/Roaming/...)
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'local-chat.db');

// Wir definieren win global, damit wir es referenzieren können, falls nötig
let win: BrowserWindow | null;

// --- DATENBANK & IPC SETUP ---
try {
  // 1. Verbindung zur SQLite DB
  const db = new Database(dbPath);
  
  // Tabelle erstellen
  db.exec("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, content TEXT)");

  // 2. IPC Handler für die Datenbank
  ipcMain.handle('db:save-message', (_event, content) => {
    const stmt = db.prepare('INSERT INTO messages (content) VALUES (?)');
    const info = stmt.run(content);
    return info.lastInsertRowid;
  });

  ipcMain.handle('db:get-messages', () => {
    const stmt = db.prepare('SELECT * FROM messages');
    return stmt.all();
  });

  // 3. IPC Handler für NEUE FENSTER (Pop-out Chat)
  ipcMain.handle('win:open-chat', (_event, chatId, chatName) => {
    // Neues Fenster erstellen
    const chatWin = new BrowserWindow({
      width: 400,
      height: 600,
      minWidth: 320,
      minHeight: 400,
      title: `Chat mit ${chatName}`,
      autoHideMenuBar: true, // Menüleiste ausblenden (Windows/Linux)
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Wir nutzen denselben Preload wie das Hauptfenster
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    // --- Handler: Chat wieder andocken ---
  ipcMain.handle('win:dock-chat', (event, chatId, chatName) => {
    // 1. Das Fenster finden, das den Befehl gesendet hat (das Popout)
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    
    // 2. Signal an das Hauptfenster senden ('win' ist unsere globale Variable für das Main Window)
    if (win) {
      win.webContents.send('chat-docked-back', chatId, chatName);
    }

    // 3. Das Popout Fenster schließen
    if (senderWin && !senderWin.isDestroyed()) {
      senderWin.close();
    }
  });

    // Die URL zusammenbauen
    // Im Dev-Modus: http://localhost:5173/#/popout/123?name=Anna
    // In Production: file://.../index.html#/popout/123?name=Anna
    const popupUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}/#/popout/${chatId}?name=${encodeURIComponent(chatName)}`
      : `file://${path.join(__dirname, '../dist/index.html')}#/popout/${chatId}?name=${encodeURIComponent(chatName)}`;

    chatWin.loadURL(popupUrl);
  });

} catch (error) {
  console.error("Initialisierungs-Fehler:", error);
}

// --- HAUPTFENSTER SETUP ---

// Vite Environment Variablen (für Production Build Pfade)
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // URL laden
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

// App Lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  win = null;
  // Auf Mac schließt man die App gewöhnlich nicht komplett, auf Windows schon
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
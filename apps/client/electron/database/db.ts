import { app } from 'electron';
import path from 'path';
// Speichert db unter: C:\Users\Name\AppData\Roaming\DeinAppHame\chat.db
const dbPath = path.join(app.getPath('userData'), 'chat.db');
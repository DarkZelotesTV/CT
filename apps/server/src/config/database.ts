import { Sequelize } from 'sequelize';
import path from 'path';

// Wir speichern die DB-Datei im Root-Ordner des Servers (apps/server/server.sqlite)
const dbPath = path.join(__dirname, '../../server.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath, // Hier liegt die Datei
  logging: false,  // Weniger Text im Terminal
});
import fs from 'fs';
import { Dialect, Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Lädt Variablen aus der .env Datei
dotenv.config();

const dialect = (process.env.DB_DIALECT || 'sqlite') as Dialect;

const createSequelizeInstance = () => {
  if (dialect === 'mysql') {
    return new Sequelize(
      process.env.DB_NAME || 'clover_talk',      // Name der Datenbank
      process.env.DB_USER || 'root',             // Dein MySQL Benutzername
      process.env.DB_PASSWORD || '',             // Dein MySQL Passwort
      {
        host: process.env.DB_HOST || 'localhost', // Wo läuft die DB?
        dialect,
        logging: false,                           // Keine SQL-Logs im Terminal (sauberer)
        pool: {
          max: 5,                                 // Maximale gleichzeitige Verbindungen
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );
  }

  if (dialect === 'sqlite') {
    const dataDirectory = './data';
    fs.mkdirSync(dataDirectory, { recursive: true });
    const storagePath = `${dataDirectory}/clovertalk.db`;

    return new Sequelize({
      dialect,
      storage: storagePath,
      logging: false
    });
  }

  throw new Error(`Unsupported DB_DIALECT: ${dialect}`);
};

export const sequelize = createSequelizeInstance();

// Verbindungstest beim Start
sequelize.authenticate()
  .then(() => console.log(`✅ Verbindung zur Datenbank erfolgreich (Dialect: ${dialect})`))
  .catch(err => console.error('❌ Datenbank-Fehler:', err));

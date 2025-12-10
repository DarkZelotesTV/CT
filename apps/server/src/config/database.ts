import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Lädt Variablen aus der .env Datei
dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'clover_talk',      // Name der Datenbank
  process.env.DB_USER || 'root',             // Dein MySQL Benutzername
  process.env.DB_PASSWORD || '',             // Dein MySQL Passwort
  {
    host: process.env.DB_HOST || 'localhost', // Wo läuft die DB?
    dialect: 'mysql',                         // WICHTIG: MySQL Treiber nutzen
    logging: false,                           // Keine SQL-Logs im Terminal (sauberer)
    pool: {
      max: 5,                                 // Maximale gleichzeitige Verbindungen
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Verbindungstest beim Start
sequelize.authenticate()
  .then(() => console.log('✅ Verbindung zu MySQL erfolgreich!'))
  .catch(err => console.error('❌ Datenbank-Fehler:', err));
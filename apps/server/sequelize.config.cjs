const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dialect = process.env.DB_DIALECT || 'sqlite';

const resolveSqliteStoragePath = () => {
  const defaultStorage = path.resolve(__dirname, 'data/clovertalk.db');
  const storagePath = process.env.DB_STORAGE
    ? path.resolve(process.env.DB_STORAGE)
    : defaultStorage;

  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  return storagePath;
};

const common = {
  dialect,
  logging: false,
};

const sqlite = {
  ...common,
  storage: resolveSqliteStoragePath(),
};

const mysql = {
  ...common,
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clover_talk',
};

const configForDialect = dialect === 'mysql' ? mysql : sqlite;

module.exports = {
  development: configForDialect,
  test: configForDialect,
  production: configForDialect,
};

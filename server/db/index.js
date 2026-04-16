/**
 * SQLite singleton — path from DB_PATH or data/awaaz.db
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbInstance = null;

function readSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  return fs.readFileSync(schemaPath, 'utf8');
}

/**
 * @param {string} [dbPath]
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase(dbPath) {
  const resolved = dbPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'awaaz.db');
  const dir = path.dirname(resolved);
  if (resolved !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readSchema());
  return db;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** @param {import('better-sqlite3').Database} db */
export function setDbForTests(db) {
  dbInstance = db;
}

export function resetDbSingleton() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
    dbInstance = null;
  }
}

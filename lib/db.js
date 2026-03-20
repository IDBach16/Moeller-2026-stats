const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'moeller.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Migration: add game_tag column if it doesn't exist (preserves existing data)
  const cols = db.prepare("PRAGMA table_info(games)").all();
  const hasGameTag = cols.some(c => c.name === 'game_tag');
  if (!hasGameTag) {
    db.exec("ALTER TABLE games ADD COLUMN game_tag TEXT NOT NULL DEFAULT 'conference'");
    console.log('Migration: added game_tag column to games table');
  }
}

function resetDb() {
  if (db) db.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  db = null;
  return getDb();
}

module.exports = { getDb, resetDb, DB_PATH };

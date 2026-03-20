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

  // Migrations: add columns if they don't exist (preserves existing data)
  const cols = db.prepare("PRAGMA table_info(games)").all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('game_tag')) {
    db.exec("ALTER TABLE games ADD COLUMN game_tag TEXT NOT NULL DEFAULT 'conference'");
    console.log('Migration: added game_tag column');
  }
  if (!colNames.includes('opponent')) {
    db.exec("ALTER TABLE games ADD COLUMN opponent TEXT DEFAULT ''");
    console.log('Migration: added opponent column');
  }
  if (!colNames.includes('home_away')) {
    db.exec("ALTER TABLE games ADD COLUMN home_away TEXT DEFAULT 'home'");
    console.log('Migration: added home_away column');
  }
}

function resetDb() {
  if (db) db.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  db = null;
  return getDb();
}

module.exports = { getDb, resetDb, DB_PATH };

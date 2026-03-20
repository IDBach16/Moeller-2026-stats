CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_year TEXT,
  is_pitcher INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_number INTEGER NOT NULL,
  season_type TEXT NOT NULL CHECK(season_type IN ('regular','postseason')),
  game_tag TEXT NOT NULL DEFAULT 'conference' CHECK(game_tag IN ('conference','non_conference','exhibition')),
  result TEXT CHECK(result IN ('W','L','T',NULL))
);

CREATE TABLE IF NOT EXISTS game_batting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  ab INTEGER DEFAULT 0,
  r INTEGER DEFAULT 0,
  h INTEGER DEFAULT 0,
  rbi INTEGER DEFAULT 0,
  doubles INTEGER DEFAULT 0,
  triples INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  so INTEGER DEFAULT 0,
  sf INTEGER DEFAULT 0,
  sh INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  sb INTEGER DEFAULT 0,
  cs INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_pitching (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  ip_full INTEGER DEFAULT 0,
  ip_partial INTEGER DEFAULT 0,
  h INTEGER DEFAULT 0,
  r INTEGER DEFAULT 0,
  er INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  so INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  gs INTEGER DEFAULT 0,
  w INTEGER DEFAULT 0,
  l INTEGER DEFAULT 0,
  sv INTEGER DEFAULT 0,
  cg INTEGER DEFAULT 0,
  sho INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('coach','intern'))
);

-- Default config
INSERT OR IGNORE INTO config (key, value) VALUES ('season_year', '2026');
INSERT OR IGNORE INTO config (key, value) VALUES ('wins', '0');
INSERT OR IGNORE INTO config (key, value) VALUES ('losses', '0');
INSERT OR IGNORE INTO config (key, value) VALUES ('ties', '0');

-- Default user
INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ('moeller', 'moeller1', 'coach');

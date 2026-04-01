/**
 * GCL Database layer - tables and CRUD for scraped GCL data
 */

const { getDb } = require('./db');

/**
 * Create GCL tables if they don't exist
 */
function initGclSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS gcl_batting (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player TEXT NOT NULL,
      class_year TEXT,
      g INTEGER DEFAULT 0,
      ab INTEGER DEFAULT 0,
      runs INTEGER DEFAULT 0,
      hits INTEGER DEFAULT 0,
      doubles INTEGER DEFAULT 0,
      triples INTEGER DEFAULT 0,
      hr INTEGER DEFAULT 0,
      rbi INTEGER DEFAULT 0,
      sb INTEGER DEFAULT 0,
      obp REAL DEFAULT 0,
      avg REAL DEFAULT 0,
      is_totals INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gcl_pitching (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player TEXT NOT NULL,
      class_year TEXT,
      g INTEGER DEFAULT 0,
      ip TEXT DEFAULT '0.0',
      ip_full INTEGER DEFAULT 0,
      ip_partial INTEGER DEFAULT 0,
      w INTEGER DEFAULT 0,
      l INTEGER DEFAULT 0,
      sv INTEGER DEFAULT 0,
      k INTEGER DEFAULT 0,
      sho INTEGER DEFAULT 0,
      whip REAL DEFAULT 0,
      era REAL DEFAULT 0,
      is_totals INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gcl_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gcl_game_id INTEGER UNIQUE,
      date TEXT,
      opponent TEXT,
      result TEXT,
      score TEXT,
      home_away TEXT DEFAULT 'home',
      home_team TEXT,
      away_team TEXT,
      innings INTEGER,
      home_r INTEGER,
      home_h INTEGER,
      home_e INTEGER,
      away_r INTEGER,
      away_h INTEGER,
      away_e INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gcl_game_batting (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gcl_game_id INTEGER NOT NULL,
      player TEXT NOT NULL,
      class_year TEXT,
      ab INTEGER DEFAULT 0,
      r INTEGER DEFAULT 0,
      h INTEGER DEFAULT 0,
      rbi INTEGER DEFAULT 0,
      avg REAL DEFAULT 0,
      doubles INTEGER DEFAULT 0,
      triples INTEGER DEFAULT 0,
      hr INTEGER DEFAULT 0,
      bb INTEGER DEFAULT 0,
      so INTEGER DEFAULT 0,
      sf INTEGER DEFAULT 0,
      sh INTEGER DEFAULT 0,
      hbp INTEGER DEFAULT 0,
      obp REAL DEFAULT 0,
      slg REAL DEFAULT 0,
      sb INTEGER DEFAULT 0,
      UNIQUE(gcl_game_id, player)
    );

    CREATE TABLE IF NOT EXISTS gcl_game_pitching (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gcl_game_id INTEGER NOT NULL,
      player TEXT NOT NULL,
      class_year TEXT,
      ip TEXT DEFAULT '0.0',
      ip_full INTEGER DEFAULT 0,
      ip_partial INTEGER DEFAULT 0,
      h INTEGER DEFAULT 0,
      r INTEGER DEFAULT 0,
      er INTEGER DEFAULT 0,
      bb INTEGER DEFAULT 0,
      so INTEGER DEFAULT 0,
      hr INTEGER DEFAULT 0,
      era REAL DEFAULT 0,
      UNIQUE(gcl_game_id, player)
    );
  `);

  console.log('GCL schema initialized');
}

/**
 * Clear all GCL data and re-seed from scraped results
 */
function seedGclData(data) {
  const db = getDb();
  const { seasonStats, schedule, boxscores } = data;

  const txn = db.transaction(() => {
    // Clear existing data
    db.exec(`
      DELETE FROM gcl_game_pitching;
      DELETE FROM gcl_game_batting;
      DELETE FROM gcl_games;
      DELETE FROM gcl_pitching;
      DELETE FROM gcl_batting;
    `);

    // Insert season batting
    const insertBatting = db.prepare(`
      INSERT INTO gcl_batting (player, class_year, g, ab, runs, hits, doubles, triples, hr, rbi, sb, obp, avg, is_totals)
      VALUES (@player, @classYear, @g, @ab, @runs, @hits, @doubles, @triples, @hr, @rbi, @sb, @obp, @avg, @isTotals)
    `);

    for (const row of seasonStats.batting) {
      insertBatting.run({ ...row, isTotals: 0 });
    }
    if (seasonStats.battingTotals) {
      insertBatting.run({ ...seasonStats.battingTotals, isTotals: 1 });
    }

    // Insert season pitching
    const insertPitching = db.prepare(`
      INSERT INTO gcl_pitching (player, class_year, g, ip, ip_full, ip_partial, w, l, sv, k, sho, whip, era, is_totals)
      VALUES (@player, @classYear, @g, @ip, @ip_full, @ip_partial, @w, @l, @sv, @k, @sho, @whip, @era, @isTotals)
    `);

    for (const row of seasonStats.pitching) {
      insertPitching.run({ ...row, isTotals: 0 });
    }
    if (seasonStats.pitchingTotals) {
      insertPitching.run({ ...seasonStats.pitchingTotals, ip: seasonStats.pitchingTotals.ip || '0.0', isTotals: 1 });
    }

    // Insert games from schedule
    const insertGame = db.prepare(`
      INSERT OR REPLACE INTO gcl_games (gcl_game_id, date, opponent, result, score, home_away,
        home_team, away_team, innings, home_r, home_h, home_e, away_r, away_h, away_e)
      VALUES (@gclGameId, @date, @opponent, @result, @score, @homeAway,
        @homeTeam, @awayTeam, @innings, @homeR, @homeH, @homeE, @awayR, @awayH, @awayE)
    `);

    // Build a map of boxscores by gameId for quick lookup
    const boxscoreMap = new Map();
    for (const bs of boxscores) {
      boxscoreMap.set(bs.gameId, bs);
    }

    for (const game of schedule) {
      const bs = game.gameId ? boxscoreMap.get(game.gameId) : null;

      const homeTeamData = bs?.lineScore?.teams?.[1];
      const awayTeamData = bs?.lineScore?.teams?.[0];

      insertGame.run({
        gclGameId: game.gameId,
        date: game.date || bs?.date,
        opponent: game.opponent,
        result: game.result,
        score: game.score,
        homeAway: game.homeAway,
        homeTeam: bs?.homeTeam || null,
        awayTeam: bs?.awayTeam || null,
        innings: bs?.lineScore?.innings || null,
        homeR: homeTeamData?.r ?? null,
        homeH: homeTeamData?.h ?? null,
        homeE: homeTeamData?.e ?? null,
        awayR: awayTeamData?.r ?? null,
        awayH: awayTeamData?.h ?? null,
        awayE: awayTeamData?.e ?? null
      });
    }

    // Insert game-level batting and pitching
    const insertGameBatting = db.prepare(`
      INSERT OR REPLACE INTO gcl_game_batting
        (gcl_game_id, player, class_year, ab, r, h, rbi, avg, doubles, triples, hr, bb, so, sf, sh, hbp, obp, slg, sb)
      VALUES
        (@gclGameId, @player, @classYear, @ab, @r, @h, @rbi, @avg, @doubles, @triples, @hr, @bb, @so, @sf, @sh, @hbp, @obp, @slg, @sb)
    `);

    const insertGamePitching = db.prepare(`
      INSERT OR REPLACE INTO gcl_game_pitching
        (gcl_game_id, player, class_year, ip, ip_full, ip_partial, h, r, er, bb, so, hr, era)
      VALUES
        (@gclGameId, @player, @classYear, @ip, @ip_full, @ip_partial, @h, @r, @er, @bb, @so, @hr, @era)
    `);

    for (const bs of boxscores) {
      for (const batter of bs.batting) {
        insertGameBatting.run({
          gclGameId: bs.gameId,
          player: batter.player,
          classYear: batter.classYear,
          ab: batter.ab,
          r: batter.r,
          h: batter.h,
          rbi: batter.rbi,
          avg: batter.avg,
          doubles: batter.doubles,
          triples: batter.triples,
          hr: batter.hr,
          bb: batter.bb,
          so: batter.so,
          sf: batter.sf,
          sh: batter.sh,
          hbp: batter.hbp,
          obp: batter.obp,
          slg: batter.slg,
          sb: batter.sb
        });
      }

      for (const pitcher of bs.pitching) {
        insertGamePitching.run({
          gclGameId: bs.gameId,
          player: pitcher.player,
          classYear: pitcher.classYear,
          ip: pitcher.ip,
          ip_full: pitcher.ip_full,
          ip_partial: pitcher.ip_partial,
          h: pitcher.h,
          r: pitcher.r,
          er: pitcher.er,
          bb: pitcher.bb,
          so: pitcher.so,
          hr: pitcher.hr,
          era: pitcher.era
        });
      }
    }

    // Update last-scraped timestamp
    db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('gcl_last_scraped', datetime('now'))`).run();

    console.log(`Seeded GCL DB: ${seasonStats.batting.length} batters, ${seasonStats.pitching.length} pitchers, ${schedule.length} games, ${boxscores.length} boxscores`);
  });

  txn();
}

/**
 * Check if GCL data needs refreshing (older than given hours)
 */
function needsRefresh(maxAgeHours = 6) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'gcl_last_scraped'").get();
  if (!row) return true;

  const lastScraped = new Date(row.value + 'Z'); // SQLite datetime is UTC
  const ageMs = Date.now() - lastScraped.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

/**
 * Get all GCL season batting stats
 */
function getGclBatting() {
  return getDb().prepare('SELECT * FROM gcl_batting WHERE is_totals = 0 ORDER BY avg DESC').all();
}

/**
 * Get GCL batting totals
 */
function getGclBattingTotals() {
  return getDb().prepare('SELECT * FROM gcl_batting WHERE is_totals = 1').get();
}

/**
 * Get all GCL season pitching stats
 */
function getGclPitching() {
  return getDb().prepare('SELECT * FROM gcl_pitching WHERE is_totals = 0 ORDER BY era ASC').all();
}

/**
 * Get GCL pitching totals
 */
function getGclPitchingTotals() {
  return getDb().prepare('SELECT * FROM gcl_pitching WHERE is_totals = 1').get();
}

/**
 * Get all GCL games
 */
function getGclGames() {
  return getDb().prepare('SELECT * FROM gcl_games ORDER BY date ASC').all();
}

/**
 * Get game batting for a specific game
 */
function getGclGameBatting(gclGameId) {
  return getDb().prepare('SELECT * FROM gcl_game_batting WHERE gcl_game_id = ?').all(gclGameId);
}

/**
 * Get game pitching for a specific game
 */
function getGclGamePitching(gclGameId) {
  return getDb().prepare('SELECT * FROM gcl_game_pitching WHERE gcl_game_id = ?').all(gclGameId);
}

module.exports = {
  initGclSchema,
  seedGclData,
  needsRefresh,
  getGclBatting,
  getGclBattingTotals,
  getGclPitching,
  getGclPitchingTotals,
  getGclGames,
  getGclGameBatting,
  getGclGamePitching
};

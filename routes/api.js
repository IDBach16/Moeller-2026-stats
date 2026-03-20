const express = require('express');
const router = express.Router();
const { getDb, DB_PATH } = require('../lib/db');
const stats = require('../lib/stats');
const { broadcast } = require('../lib/sse');
const { addClient } = require('../lib/sse');

// Database backup download
router.get('/backup', (req, res) => {
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
  const date = new Date().toISOString().slice(0, 10);
  res.download(DB_PATH, `moeller_backup_${date}.db`);
});

// SSE endpoint
router.get('/events', (req, res) => {
  addClient(res);
});

// Batting stats
router.get('/stats/batting', (req, res) => {
  const season = req.query.season || 'total';
  const tag = req.query.tag || null;
  const rows = stats.getBattingStats(season, tag);
  const totals = stats.getBattingTotals(season, tag);
  res.json({ rows, totals });
});

// Pitching stats
router.get('/stats/pitching', (req, res) => {
  const season = req.query.season || 'total';
  const tag = req.query.tag || null;
  const rows = stats.getPitchingStats(season, tag);
  const totals = stats.getPitchingTotals(season, tag);
  res.json({ rows, totals });
});

// Games list
router.get('/games', (req, res) => {
  const season = req.query.season;
  const tag = req.query.tag;
  const games = stats.getGamesList(season, tag);
  res.json(games);
});

// Game detail
router.get('/games/:id', (req, res) => {
  const detail = stats.getGameDetail(parseInt(req.params.id));
  if (!detail) return res.status(404).json({ error: 'Game not found' });
  res.json(detail);
});

// Submit new game
router.post('/games', (req, res) => {
  const db = getDb();
  const { seasonType, gameTag, opponent, homeAway, result, batters, pitchers } = req.body;

  if (!seasonType || !batters || !pitchers) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const tag = gameTag || 'conference';
  const opp = opponent || '';
  const ha = homeAway || 'home';

  // Get next game number
  const last = db.prepare(
    'SELECT MAX(game_number) as max_num FROM games WHERE season_type = ?'
  ).get(seasonType);
  const gameNumber = (last.max_num || 0) + 1;

  const insertGame = db.prepare(
    'INSERT INTO games (game_number, season_type, game_tag, opponent, home_away, result) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertBatting = db.prepare(
    `INSERT INTO game_batting (game_id, player_id, ab, r, h, rbi, doubles, triples, hr, bb, so, sf, sh, hbp, sb, cs, errors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPitching = db.prepare(
    `INSERT INTO game_pitching (game_id, player_id, ip_full, ip_partial, h, r, er, bb, so, hr, hbp, gs, w, l, sv, cg, sho, errors)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const doInsert = db.transaction(() => {
    const gameRes = insertGame.run(gameNumber, seasonType, tag, opp, ha, result || null);
    const gameId = gameRes.lastInsertRowid;

    for (const b of batters) {
      insertBatting.run(gameId, b.player_id,
        b.ab || 0, b.r || 0, b.h || 0, b.rbi || 0,
        b.doubles || 0, b.triples || 0, b.hr || 0,
        b.bb || 0, b.so || 0, b.sf || 0, b.sh || 0, b.hbp || 0,
        b.sb || 0, b.cs || 0, b.errors || 0
      );
    }

    for (const p of pitchers) {
      insertPitching.run(gameId, p.player_id,
        p.ip_full || 0, p.ip_partial || 0,
        p.h || 0, p.r || 0, p.er || 0,
        p.bb || 0, p.so || 0, p.hr || 0, p.hbp || 0,
        p.gs || 0, p.w || 0, p.l || 0, p.sv || 0,
        p.cg || 0, p.sho || 0, p.errors || 0
      );
    }

    // Update config record
    if (result === 'W') {
      db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'wins'").run();
    } else if (result === 'L') {
      db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'losses'").run();
    } else if (result === 'T') {
      db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'ties'").run();
    }

    return gameId;
  });

  const gameId = doInsert();
  broadcast('game-added', { gameId, gameNumber, seasonType });
  res.json({ success: true, gameId });
});

// Edit game
router.put('/games/:id', (req, res) => {
  const db = getDb();
  const gameId = parseInt(req.params.id);
  const { result, gameTag, seasonType, opponent, homeAway, batters, pitchers } = req.body;

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const doUpdate = db.transaction(() => {
    if (result !== undefined) {
      // Adjust config record
      const oldResult = game.result;
      if (oldResult === 'W') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'wins'").run();
      else if (oldResult === 'L') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'losses'").run();
      else if (oldResult === 'T') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'ties'").run();

      db.prepare('UPDATE games SET result = ? WHERE id = ?').run(result, gameId);

      if (result === 'W') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'wins'").run();
      else if (result === 'L') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'losses'").run();
      else if (result === 'T') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'ties'").run();
    }

    // Update game tag
    if (gameTag) {
      db.prepare('UPDATE games SET game_tag = ? WHERE id = ?').run(gameTag, gameId);
    }

    // Update season type
    if (seasonType) {
      db.prepare('UPDATE games SET season_type = ? WHERE id = ?').run(seasonType, gameId);
    }

    // Update opponent
    if (opponent !== undefined) {
      db.prepare('UPDATE games SET opponent = ? WHERE id = ?').run(opponent, gameId);
    }

    // Update home/away
    if (homeAway) {
      db.prepare('UPDATE games SET home_away = ? WHERE id = ?').run(homeAway, gameId);
    }

    if (batters) {
      db.prepare('DELETE FROM game_batting WHERE game_id = ?').run(gameId);
      const ins = db.prepare(
        `INSERT INTO game_batting (game_id, player_id, ab, r, h, rbi, doubles, triples, hr, bb, so, sf, sh, hbp, sb, cs, errors)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const b of batters) {
        ins.run(gameId, b.player_id,
          b.ab || 0, b.r || 0, b.h || 0, b.rbi || 0,
          b.doubles || 0, b.triples || 0, b.hr || 0,
          b.bb || 0, b.so || 0, b.sf || 0, b.sh || 0, b.hbp || 0,
          b.sb || 0, b.cs || 0, b.errors || 0
        );
      }
    }

    if (pitchers) {
      db.prepare('DELETE FROM game_pitching WHERE game_id = ?').run(gameId);
      const ins = db.prepare(
        `INSERT INTO game_pitching (game_id, player_id, ip_full, ip_partial, h, r, er, bb, so, hr, hbp, gs, w, l, sv, cg, sho, errors)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const p of pitchers) {
        ins.run(gameId, p.player_id,
          p.ip_full || 0, p.ip_partial || 0,
          p.h || 0, p.r || 0, p.er || 0,
          p.bb || 0, p.so || 0, p.hr || 0, p.hbp || 0,
          p.gs || 0, p.w || 0, p.l || 0, p.sv || 0,
          p.cg || 0, p.sho || 0, p.errors || 0
        );
      }
    }
  });

  doUpdate();
  broadcast('game-updated', { gameId });
  res.json({ success: true });
});

// Delete game
router.delete('/games/:id', (req, res) => {
  const db = getDb();
  const gameId = parseInt(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  // Adjust config record
  if (game.result === 'W') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'wins'").run();
  else if (game.result === 'L') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'losses'").run();
  else if (game.result === 'T') db.prepare("UPDATE config SET value = CAST(CAST(value AS INTEGER) - 1 AS TEXT) WHERE key = 'ties'").run();

  db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
  broadcast('game-deleted', { gameId });
  res.json({ success: true });
});

// Players
router.get('/players', (req, res) => {
  if (req.query.all === '1') {
    res.json(stats.getAllPlayers());
  } else {
    res.json(stats.getPlayers());
  }
});

router.post('/players', (req, res) => {
  const db = getDb();
  const { first_name, last_name, class_year, is_pitcher } = req.body;
  const result = db.prepare(
    'INSERT INTO players (first_name, last_name, class_year, is_pitcher) VALUES (?, ?, ?, ?)'
  ).run(first_name, last_name, class_year || null, is_pitcher ? 1 : 0);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/players/:id', (req, res) => {
  const db = getDb();
  const playerId = parseInt(req.params.id);

  // Block deletion if player has game data
  const batting = db.prepare('SELECT COUNT(*) as cnt FROM game_batting WHERE player_id = ?').get(playerId);
  const pitching = db.prepare('SELECT COUNT(*) as cnt FROM game_pitching WHERE player_id = ?').get(playerId);
  if (batting.cnt > 0 || pitching.cnt > 0) {
    return res.status(400).json({ error: 'Cannot delete player with existing game data. Deactivate instead.' });
  }

  db.prepare('DELETE FROM players WHERE id = ?').run(playerId);
  res.json({ success: true });
});

router.put('/players/:id', (req, res) => {
  const db = getDb();
  const { first_name, last_name, class_year, is_pitcher, is_active } = req.body;
  db.prepare(
    'UPDATE players SET first_name=?, last_name=?, class_year=?, is_pitcher=?, is_active=? WHERE id=?'
  ).run(first_name, last_name, class_year, is_pitcher ? 1 : 0, is_active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Config
router.get('/config', (req, res) => {
  res.json(stats.getConfig());
});

router.put('/config', (req, res) => {
  const db = getDb();
  for (const [key, value] of Object.entries(req.body)) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
  }
  res.json({ success: true });
});

module.exports = router;

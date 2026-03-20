const { getDb } = require('./db');

function seasonFilter(season, tag) {
  let filter = '';
  if (season === 'regular') filter += " AND g.season_type = 'regular'";
  else if (season === 'postseason') filter += " AND g.season_type = 'postseason'";
  if (tag === 'conference') filter += " AND g.game_tag = 'conference'";
  else if (tag === 'non_conference') filter += " AND g.game_tag = 'non_conference'";
  else if (tag === 'exhibition') filter += " AND g.game_tag = 'exhibition'";
  return filter;
}

function getBattingStats(season = 'total', tag = null) {
  const db = getDb();
  const filter = seasonFilter(season, tag);
  return db.prepare(`
    SELECT
      p.id as player_id,
      p.last_name,
      p.first_name,
      p.class_year,
      COUNT(DISTINCT gb.game_id) as gp,
      SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf) + SUM(gb.sh) as pa,
      SUM(gb.ab) as ab,
      SUM(gb.h) as h,
      SUM(gb.doubles) as "2b",
      SUM(gb.triples) as "3b",
      SUM(gb.hr) as hr,
      SUM(gb.r) as r,
      SUM(gb.rbi) as rbi,
      SUM(gb.bb) as bb,
      SUM(gb.hbp) as hbp,
      SUM(gb.so) as so,
      SUM(gb.sf) as sf,
      SUM(gb.sh) as sh,
      SUM(gb.sb) as sb,
      SUM(gb.cs) as cs,
      SUM(gb.errors) as errors,
      -- Singles
      SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr) as "1b",
      -- Total bases
      SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
        + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr) as tb,
      -- AVG
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(CAST(SUM(gb.h) AS REAL) / SUM(gb.ab), 3)
        ELSE 0 END as avg,
      -- OBP
      CASE WHEN (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)) > 0
        THEN ROUND(CAST(SUM(gb.h) + SUM(gb.bb) + SUM(gb.hbp) AS REAL) /
          (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)), 3)
        ELSE 0 END as obp,
      -- SLG
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(CAST(
          SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
          + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr)
        AS REAL) / SUM(gb.ab), 3)
        ELSE 0 END as slg,
      -- OPS (computed from obp + slg)
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(
          CASE WHEN (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)) > 0
            THEN CAST(SUM(gb.h) + SUM(gb.bb) + SUM(gb.hbp) AS REAL) /
              (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf))
            ELSE 0 END
          + CAST(
            SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
            + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr)
          AS REAL) / SUM(gb.ab)
        , 3)
        ELSE 0 END as ops
    FROM game_batting gb
    JOIN players p ON p.id = gb.player_id
    JOIN games g ON g.id = gb.game_id
    WHERE 1=1 ${filter}
    GROUP BY p.id
    ORDER BY CASE WHEN SUM(gb.ab) > 0
      THEN CAST(SUM(gb.h) AS REAL) / SUM(gb.ab)
      ELSE 0 END DESC,
      p.last_name ASC
  `).all();
}

function getPitchingStats(season = 'total', tag = null) {
  const db = getDb();
  const filter = seasonFilter(season, tag);
  return db.prepare(`
    SELECT
      p.id as player_id,
      p.last_name,
      p.first_name,
      p.class_year,
      COUNT(DISTINCT gp2.game_id) as gp,
      SUM(gp2.gs) as gs,
      SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) as total_outs,
      -- IP display: full.partial
      (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) / 3 as ip_whole,
      (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) % 3 as ip_remainder,
      SUM(gp2.w) as w,
      SUM(gp2.l) as l,
      SUM(gp2.sv) as sv,
      SUM(gp2.cg) as cg,
      SUM(gp2.sho) as sho,
      SUM(gp2.h) as h,
      SUM(gp2.r) as r,
      SUM(gp2.er) as er,
      SUM(gp2.bb) as bb,
      SUM(gp2.so) as so,
      SUM(gp2.hr) as hr_allowed,
      SUM(gp2.hbp) as hbp,
      SUM(gp2.errors) as errors,
      -- ERA (7-inning for high school)
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
        THEN ROUND(CAST(SUM(gp2.er) AS REAL) * 7 * 3 /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)), 2)
        ELSE 0 END as era,
      -- WHIP
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
        THEN ROUND(CAST(SUM(gp2.h) + SUM(gp2.bb) AS REAL) * 3 /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)), 2)
        ELSE 0 END as whip,
      -- BAA (Batting Average Against)
      -- BAA = H / (total_outs + H + errors approx) - simplified: H / (IP*3/approximate_BF)
      -- More accurate: H / (total_outs + H)
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) + SUM(gp2.h)) > 0
        THEN ROUND(CAST(SUM(gp2.h) AS REAL) /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) + SUM(gp2.h) + SUM(gp2.bb) + SUM(gp2.hbp)), 3)
        ELSE 0 END as baa
    FROM game_pitching gp2
    JOIN players p ON p.id = gp2.player_id
    JOIN games g ON g.id = gp2.game_id
    WHERE 1=1 ${filter}
    GROUP BY p.id
    HAVING (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
    ORDER BY CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
      THEN CAST(SUM(gp2.er) AS REAL) * 7 * 3 /
        (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial))
      ELSE 999 END ASC,
      p.last_name ASC
  `).all();
}

function getBattingTotals(season = 'total', tag = null) {
  const db = getDb();
  const filter = seasonFilter(season, tag);
  return db.prepare(`
    SELECT
      COUNT(DISTINCT g.id) as gp,
      SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf) + SUM(gb.sh) as pa,
      SUM(gb.ab) as ab,
      SUM(gb.h) as h,
      SUM(gb.doubles) as "2b",
      SUM(gb.triples) as "3b",
      SUM(gb.hr) as hr,
      SUM(gb.r) as r,
      SUM(gb.rbi) as rbi,
      SUM(gb.bb) as bb,
      SUM(gb.hbp) as hbp,
      SUM(gb.so) as so,
      SUM(gb.sf) as sf,
      SUM(gb.sh) as sh,
      SUM(gb.sb) as sb,
      SUM(gb.cs) as cs,
      SUM(gb.errors) as errors,
      SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
        + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr) as tb,
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(CAST(SUM(gb.h) AS REAL) / SUM(gb.ab), 3) ELSE 0 END as avg,
      CASE WHEN (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)) > 0
        THEN ROUND(CAST(SUM(gb.h) + SUM(gb.bb) + SUM(gb.hbp) AS REAL) /
          (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)), 3) ELSE 0 END as obp,
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(CAST(
          SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
          + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr)
        AS REAL) / SUM(gb.ab), 3) ELSE 0 END as slg,
      CASE WHEN SUM(gb.ab) > 0
        THEN ROUND(
          CASE WHEN (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf)) > 0
            THEN CAST(SUM(gb.h) + SUM(gb.bb) + SUM(gb.hbp) AS REAL) /
              (SUM(gb.ab) + SUM(gb.bb) + SUM(gb.hbp) + SUM(gb.sf))
            ELSE 0 END
          + CAST(
            SUM(gb.h) - SUM(gb.doubles) - SUM(gb.triples) - SUM(gb.hr)
            + 2*SUM(gb.doubles) + 3*SUM(gb.triples) + 4*SUM(gb.hr)
          AS REAL) / SUM(gb.ab)
        , 3) ELSE 0 END as ops
    FROM game_batting gb
    JOIN games g ON g.id = gb.game_id
    WHERE 1=1 ${filter}
  `).get();
}

function getPitchingTotals(season = 'total', tag = null) {
  const db = getDb();
  const filter = seasonFilter(season, tag);
  return db.prepare(`
    SELECT
      COUNT(DISTINCT g.id) as gp,
      SUM(gp2.gs) as gs,
      SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) as total_outs,
      (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) / 3 as ip_whole,
      (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) % 3 as ip_remainder,
      SUM(gp2.w) as w,
      SUM(gp2.l) as l,
      SUM(gp2.sv) as sv,
      SUM(gp2.h) as h,
      SUM(gp2.r) as r,
      SUM(gp2.er) as er,
      SUM(gp2.bb) as bb,
      SUM(gp2.so) as so,
      SUM(gp2.hr) as hr_allowed,
      SUM(gp2.hbp) as hbp,
      SUM(gp2.errors) as errors,
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
        THEN ROUND(CAST(SUM(gp2.er) AS REAL) * 7 * 3 /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)), 2) ELSE 0 END as era,
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)) > 0
        THEN ROUND(CAST(SUM(gp2.h) + SUM(gp2.bb) AS REAL) * 3 /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial)), 2) ELSE 0 END as whip,
      CASE WHEN (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) + SUM(gp2.h)) > 0
        THEN ROUND(CAST(SUM(gp2.h) AS REAL) /
          (SUM(gp2.ip_full) * 3 + SUM(gp2.ip_partial) + SUM(gp2.h) + SUM(gp2.bb) + SUM(gp2.hbp)), 3) ELSE 0 END as baa
    FROM game_pitching gp2
    JOIN games g ON g.id = gp2.game_id
    WHERE 1=1 ${filter}
  `).get();
}

function getGamesList(season, tag) {
  const db = getDb();
  let where = 'WHERE 1=1';
  if (season === 'regular') where += " AND g.season_type = 'regular'";
  else if (season === 'postseason') where += " AND g.season_type = 'postseason'";
  if (tag === 'conference') where += " AND g.game_tag = 'conference'";
  else if (tag === 'non_conference') where += " AND g.game_tag = 'non_conference'";
  else if (tag === 'exhibition') where += " AND g.game_tag = 'exhibition'";
  return db.prepare(`
    SELECT g.id, g.game_number, g.season_type, g.game_tag, g.result
    FROM games g
    ${where}
    ORDER BY g.season_type, g.game_number
  `).all();
}

function getGameDetail(gameId) {
  const db = getDb();
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return null;

  const batting = db.prepare(`
    SELECT gb.*, p.first_name, p.last_name, p.class_year
    FROM game_batting gb
    JOIN players p ON p.id = gb.player_id
    WHERE gb.game_id = ?
    ORDER BY p.last_name, p.first_name
  `).all(gameId);

  const pitching = db.prepare(`
    SELECT gp.*, p.first_name, p.last_name, p.class_year
    FROM game_pitching gp
    JOIN players p ON p.id = gp.player_id
    WHERE gp.game_id = ?
    ORDER BY gp.gs DESC, p.last_name, p.first_name
  `).all(gameId);

  return { game, batting, pitching };
}

function getPlayers() {
  const db = getDb();
  return db.prepare('SELECT * FROM players WHERE is_active = 1 ORDER BY last_name, first_name').all();
}

function getAllPlayers() {
  const db = getDb();
  return db.prepare('SELECT * FROM players ORDER BY last_name, first_name').all();
}

function getConfig() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM config').all();
  const config = {};
  for (const row of rows) config[row.key] = row.value;
  return config;
}

module.exports = {
  getBattingStats,
  getPitchingStats,
  getBattingTotals,
  getPitchingTotals,
  getGamesList,
  getGameDetail,
  getPlayers,
  getAllPlayers,
  getConfig
};

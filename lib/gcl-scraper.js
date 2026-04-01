/**
 * GCL Stats Scraper for Moeller Baseball
 * Scrapes batting, pitching, schedule, and boxscore data from gcls.gclsports.com
 */

const cheerio = require('cheerio');

const BASE_URL = 'https://gcls.gclsports.com';
const SCHOOL_ID = 17;
const SAT = 21; // sport/activity type for baseball

// GCL year parameter is offset by 1 from actual season year
function gclYear(seasonYear) {
  return seasonYear - 1;
}

/**
 * Fetch a page and return a cheerio instance
 */
async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  return cheerio.load(html);
}

/**
 * Clean text: trim whitespace from cell values
 */
function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse a player name cell. Returns { name, classYear }
 * Player names are inside <a> tags, class year follows in parentheses
 */
function parsePlayerName($cell) {
  const $a = $cell.find('a');
  let name, classYear = null;

  if ($a.length) {
    name = clean($a.text());
    // Class year is text after the </a> tag, like " (Sr)"
    const fullText = clean($cell.text());
    const match = fullText.match(/\(([^)]+)\)\s*$/);
    if (match) {
      classYear = match[1].trim();
    }
  } else {
    name = clean($cell.text());
    const match = name.match(/\(([^)]+)\)\s*$/);
    if (match) {
      classYear = match[1].trim();
      name = name.replace(/\s*\([^)]+\)\s*$/, '').trim();
    }
  }

  // Remove class year from name if it got included
  name = name.replace(/\s*\([^)]+\)\s*$/, '').trim();

  return { name, classYear };
}

/**
 * Parse IP string like "13.0" or "6.2" into { full, partial }
 * In baseball, 6.1 = 6 and 1/3, 6.2 = 6 and 2/3
 */
function parseIP(ipStr) {
  const val = parseFloat(ipStr) || 0;
  const full = Math.floor(val);
  const partial = Math.round((val - full) * 10);
  return { full, partial };
}

// ============================================================
// Season Stats
// ============================================================

/**
 * Scrape season batting and pitching stats
 * @param {number} seasonYear - e.g. 2026
 * @returns {{ batting: Array, pitching: Array, battingTotals: Object, pitchingTotals: Object }}
 */
async function scrapeSeasonStats(seasonYear = 2026) {
  const year = gclYear(seasonYear);
  const url = `${BASE_URL}/bsTeamStats.aspx?sat=${SAT}&schoolid=${SCHOOL_ID}&year=${year}`;
  const $ = await fetchPage(url);

  const batting = [];
  const pitching = [];
  let battingTotals = null;
  let pitchingTotals = null;

  // Find all stat tables - batting is first, pitching is second
  const tables = $('table.sortable, table.sport-results-table, table');

  // Strategy: find tables that contain the expected header columns
  const allTables = [];
  $('table').each((i, table) => {
    allTables.push($(table));
  });

  let battingTable = null;
  let pitchingTable = null;

  for (const $table of allTables) {
    const headerText = $table.find('th').map((i, th) => clean($(th).text())).get().join(' ');

    if (!battingTable && headerText.includes('AB') && headerText.includes('HITS') && headerText.includes('AVG')) {
      battingTable = $table;
    } else if (!pitchingTable && headerText.includes('IP') && headerText.includes('ERA') && headerText.includes('WHIP')) {
      pitchingTable = $table;
    }
  }

  // Parse batting table
  // Columns: PLAYER, G, AB, RUNS, HITS, 2B, 3B, HR, RBI, SB, OBP, AVG
  if (battingTable) {
    battingTable.find('tr.odd, tr.even, tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length < 12) return;

      const cellValues = [];
      cells.each((j, td) => {
        cellValues.push(clean($(td).text()));
      });

      const isTotals = cellValues[0].toLowerCase().includes('totals');
      const playerInfo = isTotals ? { name: 'Totals', classYear: null } : parsePlayerName($(cells[0]));

      const row_data = {
        player: playerInfo.name,
        classYear: playerInfo.classYear,
        g: parseInt(cellValues[1]) || 0,
        ab: parseInt(cellValues[2]) || 0,
        runs: parseInt(cellValues[3]) || 0,
        hits: parseInt(cellValues[4]) || 0,
        doubles: parseInt(cellValues[5]) || 0,
        triples: parseInt(cellValues[6]) || 0,
        hr: parseInt(cellValues[7]) || 0,
        rbi: parseInt(cellValues[8]) || 0,
        sb: parseInt(cellValues[9]) || 0,
        obp: parseFloat(cellValues[10]) || 0,
        avg: parseFloat(cellValues[11]) || 0
      };

      if (isTotals) {
        battingTotals = row_data;
      } else if (playerInfo.name && playerInfo.name !== 'PLAYER') {
        batting.push(row_data);
      }
    });
  }

  // Parse pitching table
  // Columns: PLAYER, G, IP, W, L, SV, K, SHO, WHIP, ERA
  if (pitchingTable) {
    pitchingTable.find('tr.odd, tr.even, tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length < 10) return;

      const cellValues = [];
      cells.each((j, td) => {
        cellValues.push(clean($(td).text()));
      });

      const isTotals = cellValues[0].toLowerCase().includes('totals');
      const playerInfo = isTotals ? { name: 'Totals', classYear: null } : parsePlayerName($(cells[0]));

      const ipParsed = parseIP(cellValues[2]);

      const row_data = {
        player: playerInfo.name,
        classYear: playerInfo.classYear,
        g: parseInt(cellValues[1]) || 0,
        ip: cellValues[2],
        ip_full: ipParsed.full,
        ip_partial: ipParsed.partial,
        w: parseInt(cellValues[3]) || 0,
        l: parseInt(cellValues[4]) || 0,
        sv: parseInt(cellValues[5]) || 0,
        k: parseInt(cellValues[6]) || 0,
        sho: parseInt(cellValues[7]) || 0,
        whip: parseFloat(cellValues[8]) || 0,
        era: parseFloat(cellValues[9]) || 0
      };

      if (isTotals) {
        pitchingTotals = row_data;
      } else if (playerInfo.name && playerInfo.name !== 'PLAYER') {
        pitching.push(row_data);
      }
    });
  }

  console.log(`  Scraped season stats: ${batting.length} batters, ${pitching.length} pitchers`);
  return { batting, pitching, battingTotals, pitchingTotals };
}

// ============================================================
// Schedule / Results
// ============================================================

/**
 * Scrape schedule and results
 * @param {number} seasonYear - e.g. 2026
 * @returns {Array<{ gameId, date, opponent, result, score, homeAway }>}
 */
async function scrapeSchedule(seasonYear = 2026) {
  const year = gclYear(seasonYear);
  const url = `${BASE_URL}/bsTeamSchedule.aspx?sat=${SAT}&schoolid=${SCHOOL_ID}&year=${year}`;
  const $ = await fetchPage(url);

  const games = [];
  let currentMonth = '';
  let currentYear = seasonYear;

  // The page has results table and schedule table
  // Results have links like <a href="bsGameStats.aspx?gameid=523429">W 10-2</a>
  // Schedule has future games with times

  $('table').each((tableIdx, table) => {
    const $table = $(table);
    const headerText = $table.find('th').map((i, th) => clean($(th).text())).get().join(' ');

    // Results table has OPPONENT RESULT RECORD columns
    // Schedule table has OPPONENT TIME LOCATION columns
    const isResults = headerText.includes('RESULT') && headerText.includes('RECORD');
    const isSchedule = headerText.includes('TIME') && headerText.includes('LOCATION');

    if (!isResults && !isSchedule) return;

    $table.find('tr').each((rowIdx, row) => {
      const $row = $(row);

      // Check for month header row - can be th with or without colspan
      const $headerCells = $row.find('th');
      if ($headerCells.length) {
        let foundMonth = false;
        $headerCells.each((hi, th) => {
          const monthText = clean($(th).text());
          const monthMatch = monthText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s*(\d{4})$/i);
          if (monthMatch) {
            currentMonth = monthMatch[1];
            currentYear = parseInt(monthMatch[2]);
            foundMonth = true;
          }
        });
        if (foundMonth) return;
        // Skip other header rows (column headers like OPPONENT, RESULT, etc.)
        if ($headerCells.length > 1) return;
      }

      const cells = $row.find('td');
      if (cells.length < 2) return;

      if (isResults) {
        // Results: day | opponent | result link | record
        const dayText = clean($(cells[0]).text()); // "Sat. 28"
        const dayMatch = dayText.match(/(\d+)/);
        if (!dayMatch) return;
        const day = dayMatch[1];

        const opponentText = clean($(cells[1]).text());
        let homeAway = 'home';
        let opponent = opponentText;
        if (opponentText.startsWith('at ')) {
          homeAway = 'away';
          opponent = opponentText.replace(/^at\s+/, '');
        }

        // Result cell contains a link with game ID
        const $resultCell = $(cells[2]);
        const $link = $resultCell.find('a');
        let gameId = null;
        let result = null;
        let score = null;

        if ($link.length) {
          const href = $link.attr('href') || '';
          const idMatch = href.match(/gameid=(\d+)/);
          if (idMatch) gameId = parseInt(idMatch[1]);

          const resultText = clean($link.text()); // "W 10-2"
          const resultMatch = resultText.match(/^([WLT])\s+(\d+-\d+)/);
          if (resultMatch) {
            result = resultMatch[1];
            score = resultMatch[2];
          }
        }

        // Build date string
        const monthNum = monthToNum(currentMonth);
        const date = `${currentYear}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        if (gameId) {
          games.push({ gameId, date, opponent, result, score, homeAway });
        }
      } else if (isSchedule) {
        // Future games (no result yet)
        const dayText = clean($(cells[0]).text());
        const dayMatch = dayText.match(/(\d+)/);
        if (!dayMatch) return;
        const day = dayMatch[1];

        const opponentText = clean($(cells[1]).text());
        let homeAway = 'home';
        let opponent = opponentText;
        if (opponentText.startsWith('at ')) {
          homeAway = 'away';
          opponent = opponentText.replace(/^at\s+/, '');
        }

        const monthNum = monthToNum(currentMonth);
        const date = `${currentYear}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        games.push({ gameId: null, date, opponent, result: null, score: null, homeAway });
      }
    });
  });

  console.log(`  Scraped schedule: ${games.length} games (${games.filter(g => g.gameId).length} with results)`);
  return games;
}

function monthToNum(abbr) {
  const map = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  return map[(abbr || '').toLowerCase().slice(0, 3)] || 1;
}

// ============================================================
// Game Boxscore
// ============================================================

/**
 * Scrape individual game boxscore
 * @param {number} gameId
 * @returns {{ date, homeTeam, awayTeam, lineScore, batting: Array, pitching: Array }}
 */
async function scrapeGameBoxscore(gameId) {
  const url = `${BASE_URL}/bsGameStats.aspx?gameid=${gameId}`;
  const $ = await fetchPage(url);

  // Date: <div align="center" class="smaller-text">Saturday, March 28, 2026</div>
  let date = null;
  $('div.smaller-text, div[class*="smaller"]').each((i, el) => {
    const text = clean($(el).text());
    const dateMatch = text.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d{4})/);
    if (dateMatch && !date) {
      const month = monthToNum(dateMatch[2]);
      date = `${dateMatch[4]}-${String(month).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
    }
  });

  // If date not found in div, try broader search
  if (!date) {
    const bodyText = $('body').text();
    const dateMatch = bodyText.match(/(\w+day),\s+(\w+)\s+(\d+),\s+(\d{4})/);
    if (dateMatch) {
      const month = monthToNum(dateMatch[2]);
      date = `${dateMatch[4]}-${String(month).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
    }
  }

  // Find team names and line score
  let homeTeam = null;
  let awayTeam = null;
  let lineScore = null;

  // Line score table has innings + R H E
  const allTables = [];
  $('table').each((i, table) => allTables.push($(table)));

  for (const $table of allTables) {
    const headers = $table.find('th').map((i, th) => clean($(th).text())).get();
    // Line score table has numbered innings and R, H, E columns
    if (headers.includes('R') && headers.includes('H') && headers.includes('E') && headers.some(h => h === '1')) {
      const innings = headers.filter(h => /^\d+$/.test(h));
      const rows = $table.find('tr').slice(1); // skip header

      lineScore = { innings: innings.length, teams: [] };

      rows.each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;

        const teamName = clean($(cells[0]).text());
        const scores = [];
        cells.each((j, td) => {
          if (j === 0) return; // skip team name
          scores.push(clean($(td).text()));
        });

        // Last 3 values are R, H, E
        const rhe = scores.slice(-3);
        const inningScores = scores.slice(0, -3);

        const teamData = {
          team: teamName,
          innings: inningScores.map(s => parseInt(s) || 0),
          r: parseInt(rhe[0]) || 0,
          h: parseInt(rhe[1]) || 0,
          e: parseInt(rhe[2]) || 0
        };

        lineScore.teams.push(teamData);

        if (i === 0) awayTeam = teamName;
        if (i === 1) homeTeam = teamName;
      });
      break;
    }
  }

  // Find Moeller batting and pitching tables
  // Batting: PLAYER, AB, R, H, RBI, AVG, 2B, 3B, HR, BB, SO, SF, SH, HBP, OBP, SLG, SB (17 cols)
  // Pitching: PLAYER, IP, H, R, ER, BB, SO, HR, ERA, (blank) (10 cols)
  //
  // "Moeller" appears as a heading/section label OUTSIDE the table, not inside <th>.
  // We identify tables by their column headers. The page may have stats for both teams
  // (opponent batting/pitching first, then Moeller), so we look for the Moeller section
  // by checking if the text "Moeller" appears in a preceding element, or we take the
  // second batting/pitching table (Moeller is home team display order).
  // For non-GCL opponents, only Moeller stats appear.

  const batting = [];
  const pitching = [];

  // Collect all table info with their preceding context
  const tableInfos = [];
  for (const $table of allTables) {
    // Get all header texts from this table
    const allHeaders = $table.find('th').map((i, th) => clean($(th).text())).get();
    const headerStr = allHeaders.join(' ');

    // Check if "Moeller" appears in any th (could be a colspan heading row)
    const hasMoellerTh = allHeaders.some(h => h.toLowerCase().includes('moeller'));

    // Check preceding siblings/elements for "Moeller" text
    let prevText = '';
    const prev = $table.prev();
    if (prev.length) {
      prevText = clean(prev.text()).toLowerCase();
    }
    // Also check parent context
    const parentText = clean($table.parent().clone().children('table').remove().end().text()).toLowerCase();

    const isMoellerContext = hasMoellerTh || prevText.includes('moeller') || parentText.includes('moeller');

    tableInfos.push({ $table, headerStr, allHeaders, isMoellerContext });
  }

  // Find batting tables (have AB and SLG columns)
  const battingTables = tableInfos.filter(t => t.headerStr.includes('AB') && t.headerStr.includes('SLG'));
  // Find pitching tables (have IP and ER columns, but NOT AB — to exclude batting)
  const pitchingTables = tableInfos.filter(t => t.headerStr.includes('IP') && t.headerStr.includes('ER') && !t.headerStr.includes('AB'));

  // Pick the Moeller table: prefer one with Moeller context, otherwise take last (Moeller is home)
  const moellerBattingTable = battingTables.find(t => t.isMoellerContext) || battingTables[battingTables.length - 1];
  const moellerPitchingTable = pitchingTables.find(t => t.isMoellerContext) || pitchingTables[pitchingTables.length - 1];

  if (moellerBattingTable) {
    // Batting columns: PLAYER, AB, R, H, RBI, AVG, 2B, 3B, HR, BB, SO, SF, SH, HBP, OBP, SLG, SB
    moellerBattingTable.$table.find('tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 16) return;

      const cellValues = [];
      cells.each((j, td) => cellValues.push(clean($(td).text())));

      const playerInfo = parsePlayerName($(cells[0]));
      if (!playerInfo.name || playerInfo.name.toLowerCase() === 'totals' || playerInfo.name.toLowerCase() === 'team') return;

      batting.push({
        player: playerInfo.name,
        classYear: playerInfo.classYear,
        ab: parseInt(cellValues[1]) || 0,
        r: parseInt(cellValues[2]) || 0,
        h: parseInt(cellValues[3]) || 0,
        rbi: parseInt(cellValues[4]) || 0,
        avg: parseFloat(cellValues[5]) || 0,
        doubles: parseInt(cellValues[6]) || 0,
        triples: parseInt(cellValues[7]) || 0,
        hr: parseInt(cellValues[8]) || 0,
        bb: parseInt(cellValues[9]) || 0,
        so: parseInt(cellValues[10]) || 0,
        sf: parseInt(cellValues[11]) || 0,
        sh: parseInt(cellValues[12]) || 0,
        hbp: parseInt(cellValues[13]) || 0,
        obp: parseFloat(cellValues[14]) || 0,
        slg: parseFloat(cellValues[15]) || 0,
        sb: parseInt(cellValues[16]) || 0
      });
    });
  }

  if (moellerPitchingTable) {
    // Pitching columns: PLAYER, IP, H, R, ER, BB, SO, HR, ERA, (blank)
    moellerPitchingTable.$table.find('tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 8) return;

      const cellValues = [];
      cells.each((j, td) => cellValues.push(clean($(td).text())));

      const playerInfo = parsePlayerName($(cells[0]));
      if (!playerInfo.name || playerInfo.name.toLowerCase() === 'totals' || playerInfo.name.toLowerCase() === 'team') return;

      const ipParsed = parseIP(cellValues[1]);

      pitching.push({
        player: playerInfo.name,
        classYear: playerInfo.classYear,
        ip: cellValues[1],
        ip_full: ipParsed.full,
        ip_partial: ipParsed.partial,
        h: parseInt(cellValues[2]) || 0,
        r: parseInt(cellValues[3]) || 0,
        er: parseInt(cellValues[4]) || 0,
        bb: parseInt(cellValues[5]) || 0,
        so: parseInt(cellValues[6]) || 0,
        hr: parseInt(cellValues[7]) || 0,
        era: parseFloat(cellValues[8]) || 0
      });
    });
  }

  console.log(`  Scraped game ${gameId}: ${batting.length} batters, ${pitching.length} pitchers`);
  return { gameId, date, homeTeam, awayTeam, lineScore, batting, pitching };
}

// ============================================================
// Scrape All
// ============================================================

/**
 * Scrape all GCL data: season stats, schedule, and all available boxscores
 * @param {number} seasonYear
 * @returns {{ seasonStats, schedule, boxscores }}
 */
async function scrapeAll(seasonYear = 2026) {
  console.log(`Scraping GCL data for ${seasonYear} season...`);

  const seasonStats = await scrapeSeasonStats(seasonYear);
  const schedule = await scrapeSchedule(seasonYear);

  // Scrape individual game boxscores for games that have results
  const gamesWithResults = schedule.filter(g => g.gameId);
  const boxscores = [];

  for (const game of gamesWithResults) {
    try {
      const boxscore = await scrapeGameBoxscore(game.gameId);
      boxscores.push(boxscore);
      // Small delay to be polite to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`  Warning: failed to scrape game ${game.gameId}: ${err.message}`);
    }
  }

  console.log(`Scraping complete: ${boxscores.length} boxscores scraped`);
  return { seasonStats, schedule, boxscores };
}

module.exports = {
  scrapeSeasonStats,
  scrapeSchedule,
  scrapeGameBoxscore,
  scrapeAll,
  BASE_URL,
  SCHOOL_ID,
  SAT
};

#!/usr/bin/env node

/**
 * Standalone script to scrape GCL stats and seed the database.
 *
 * Usage:
 *   node scripts/scrape-gcl.js [seasonYear]
 *
 * Examples:
 *   node scripts/scrape-gcl.js        # defaults to 2026
 *   node scripts/scrape-gcl.js 2026
 */

const path = require('path');

// Set DATA_DIR relative to project root so db.js finds the right location
if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(__dirname, '..', 'data');
}

const { scrapeAll } = require('../lib/gcl-scraper');
const { initGclSchema, seedGclData } = require('../lib/gcl-db');
const { getDb } = require('../lib/db');

const seasonYear = parseInt(process.argv[2]) || 2026;

async function main() {
  console.log(`=== GCL Scraper ===`);
  console.log(`Season: ${seasonYear}`);
  console.log(`GCL year param: ${seasonYear - 1}`);
  console.log();

  // Ensure DB and GCL schema exist
  getDb();
  initGclSchema();

  try {
    // Scrape all data
    const data = await scrapeAll(seasonYear);

    // Show summary before seeding
    console.log();
    console.log('--- Summary ---');
    console.log(`Season batting:  ${data.seasonStats.batting.length} players`);
    console.log(`Season pitching: ${data.seasonStats.pitching.length} players`);
    console.log(`Schedule:        ${data.schedule.length} games`);
    console.log(`Boxscores:       ${data.boxscores.length} scraped`);

    if (data.seasonStats.battingTotals) {
      const t = data.seasonStats.battingTotals;
      console.log(`Team batting:    ${t.hits}/${t.ab} (${t.avg}), ${t.runs} R, ${t.hr} HR`);
    }
    if (data.seasonStats.pitchingTotals) {
      const t = data.seasonStats.pitchingTotals;
      console.log(`Team pitching:   ${t.ip} IP, ${t.era} ERA, ${t.k} K`);
    }

    // Seed database
    console.log();
    console.log('Seeding database...');
    seedGclData(data);

    console.log();
    console.log('Done! GCL data has been scraped and stored in the database.');

  } catch (err) {
    console.error('Scraping failed:', err);
    process.exit(1);
  }
}

main();

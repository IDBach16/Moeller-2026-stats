const express = require('express');
const router = express.Router();
const stats = require('../lib/stats');

router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'coach' ? '/coach' : '/entry');
  }
  res.redirect('/login');
});

router.get('/coach', (req, res) => {
  const config = stats.getConfig();
  res.render('coach', { config, user: req.session.user });
});

router.get('/coach/print', (req, res) => {
  const config = stats.getConfig();
  const season = req.query.season || 'total';
  const batting = stats.getBattingStats(season);
  const pitching = stats.getPitchingStats(season);
  const battingTotals = stats.getBattingTotals(season);
  const pitchingTotals = stats.getPitchingTotals(season);
  res.render('print', { config, batting, pitching, battingTotals, pitchingTotals, season });
});

router.get('/entry', (req, res) => {
  const config = stats.getConfig();
  res.render('entry', { config, user: req.session.user });
});

router.get('/roster', (req, res) => {
  const config = stats.getConfig();
  res.render('roster', { config, user: req.session.user });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/db');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || user.password_hash !== password) {
    return res.render('login', { error: 'Invalid username or password' });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  if (user.role === 'coach') return res.redirect('/coach');
  return res.redirect('/entry');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== role && req.session.user.role !== 'coach') {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

module.exports = { router, requireAuth, requireRole };

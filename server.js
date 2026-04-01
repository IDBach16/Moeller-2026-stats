const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'moeller-crusaders-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const { router: authRouter } = require('./routes/auth');
const apiRouter = require('./routes/api');
const pagesRouter = require('./routes/pages');

app.use('/', authRouter);
app.use('/api', apiRouter);
app.use('/', pagesRouter);

// Initialize database on startup
require('./lib/db').getDb();

// Initialize GCL schema and scrape on startup if stale
const gclDb = require('./lib/gcl-db');
const { scrapeAll } = require('./lib/gcl-scraper');
gclDb.initGclSchema();

(async () => {
  if (gclDb.needsRefresh(6)) {
    console.log('GCL data is stale, scraping...');
    try {
      const data = await scrapeAll(2026);
      gclDb.seedGclData(data);
      console.log('GCL data refreshed on startup');
    } catch (err) {
      console.error('GCL startup scrape failed:', err.message);
    }
  } else {
    console.log('GCL data is fresh, skipping scrape');
  }
})();

app.listen(PORT, () => {
  console.log(`Moeller Stats running at http://localhost:${PORT}`);
});

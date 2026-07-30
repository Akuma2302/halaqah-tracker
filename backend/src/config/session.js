const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');

// Sessions are stored in Supabase Postgres (table auto-created on boot) instead
// of Mongo, so login state survives Render restarts/redeploys just like before.
const sessionMiddleware = session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});

module.exports = sessionMiddleware;

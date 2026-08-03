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
    // Frontend (Netlify) and backend (Render) are different domains, so this
    // is a cross-site request from the browser's point of view. SameSite=Lax
    // cookies are NOT sent on cross-site fetch/XHR calls (only top-level
    // navigations), which silently breaks every authenticated request after
    // login. SameSite=None (+ Secure, required alongside it) fixes that.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});

module.exports = sessionMiddleware;

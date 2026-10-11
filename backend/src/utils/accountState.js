const pool = require('../config/db');

// Who runs the app, and which accounts are switched off.
//
// The owner is named by email (ADMIN_EMAILS, comma-separated), so there is
// always an admin even before anyone has been promoted in the dashboard, and
// the owner can never be demoted, suspended or deleted from it. Other admins
// are users with users.is_admin set.
const OWNER_EMAILS = (process.env.ADMIN_EMAILS || 'asyraaf2302@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isOwner = (userRow) => !!userRow && OWNER_EMAILS.includes(String(userRow.email || '').toLowerCase());
const isAdmin = (userRow) => !!userRow && (userRow.is_admin === true || isOwner(userRow));

// Suspended accounts are kept in memory so every request can be checked
// without a database round trip. Set at once when an admin suspends someone
// here, and re-read every minute in case it changed elsewhere.
let suspended = new Set();

async function refresh() {
  const { rows } = await pool.query('select id from users where suspended_at is not null');
  suspended = new Set(rows.map((row) => row.id));
}

function start() {
  refresh().catch((err) => console.error('Could not load suspended accounts:', err.message));
  setInterval(() => refresh().catch(() => {}), 60 * 1000).unref();
}

const isSuspended = (userId) => suspended.has(userId);

function setSuspended(userId, on) {
  if (on) suspended.add(userId);
  else suspended.delete(userId);
}

// "Last active": stamped at most once every ten minutes per user, in the
// background, so it costs a request nothing.
const TOUCH_EVERY_MS = 10 * 60 * 1000;
const lastTouch = new Map();

function touch(userId) {
  const now = Date.now();
  if (now - (lastTouch.get(userId) || 0) < TOUCH_EVERY_MS) return;
  lastTouch.set(userId, now);
  pool.query('update users set last_active_at = now() where id = $1', [userId]).catch(() => lastTouch.delete(userId));
}

module.exports = { isOwner, isAdmin, start, isSuspended, setSuspended, touch };

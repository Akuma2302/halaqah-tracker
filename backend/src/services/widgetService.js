const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const { FIELD_MAP, CAMEL_FIELDS, TILAWAH_PAGES_COLUMN, ZIKIR_COUNT_COLUMN } = require('../models/MutabaahEntry');

// Read-only "today's mutabaah score" for home-screen widget apps (Scriptable on
// iOS, KWGT on Android). Those apps can't sign in with Google, so each user can
// mint a long random token that grants read access to this one summary only.

const LABELS = {
  tahajud: 'Tahajud',
  subuhBerjemaah: 'Subuh Berjemaah',
  mathuratPagi: 'Mathurat Pagi',
  mathuratPetang: 'Mathurat Petang',
  dhuha: 'Dhuha',
  tilawah: 'Tilawah',
  zikir: 'Istighfar'
};

const DEFAULT_TIME_ZONE = 'Asia/Kuala_Lumpur';
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;

async function getToken(userId) {
  const user = await userRepository.findById(userId);
  return user?.widget_token || null;
}

// Creates a token, or replaces the old one (which stops working immediately).
async function rotateToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await userRepository.update(userId, { widget_token: token });
  return token;
}

async function disable(userId) {
  await userRepository.update(userId, { widget_token: null });
}

function resolveTimeZone(tz) {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// "YYYY-MM-DD" for `date` as seen in `timeZone` (en-CA formats as ISO dates).
function localDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hasAmal(row) {
  return !!row && CAMEL_FIELDS.some((camel) => row[FIELD_MAP[camel]]);
}

// Same rule as the dashboard: consecutive days with at least one item ticked,
// counting from yesterday if today is still empty.
function streakFrom(rowsByDate, today) {
  let day = hasAmal(rowsByDate[today]) ? today : shiftDate(today, -1);
  let streak = 0;
  while (hasAmal(rowsByDate[day])) {
    streak += 1;
    day = shiftDate(day, -1);
  }
  return streak;
}

// Returns null when the token doesn't match anyone (caller sends 404).
async function getWidgetData(token, tz) {
  if (!TOKEN_PATTERN.test(token || '')) return null;
  const user = await userRepository.findByWidgetToken(token);
  if (!user) return null;

  const timeZone = resolveTimeZone(tz);
  const today = localDate(new Date(), timeZone);
  const rows = await mutabaahRepository.findBoundedRangeForUser(user.id, shiftDate(today, -31), today);
  const rowsByDate = Object.fromEntries(rows.map((r) => [r.date, r]));
  const todayRow = rowsByDate[today];

  const items = CAMEL_FIELDS.map((camel) => ({
    key: camel,
    label: LABELS[camel],
    done: !!todayRow?.[FIELD_MAP[camel]]
  }));
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = Math.round((done / total) * 100);

  return {
    name: user.name.split(' ')[0],
    date: today,
    timeZone,
    done,
    total,
    remaining: total - done,
    percent,
    summary: `${done}/${total} · ${percent}%`,
    items,
    tilawahPages: todayRow?.[TILAWAH_PAGES_COLUMN] || 0,
    zikirCount: todayRow?.[ZIKIR_COUNT_COLUMN] || 0,
    streak: streakFrom(rowsByDate, today),
    generatedAt: new Date().toISOString()
  };
}

module.exports = { getToken, rotateToken, disable, getWidgetData };

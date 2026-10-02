const mutabaahRepository = require('../repositories/mutabaahRepository');
const { FIELD_MAP, CAMEL_FIELDS, TILAWAH_PAGES_COLUMN, ZIKIR_COUNT_COLUMN } = require('../models/MutabaahEntry');

function toApiShape(row, userId, date) {
  if (!row) {
    return { userId, date, ...Object.fromEntries(CAMEL_FIELDS.map((f) => [f, false])), tilawahPages: 0, zikirCount: 0 };
  }
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    ...Object.fromEntries(CAMEL_FIELDS.map((camel) => [camel, row[FIELD_MAP[camel]]])),
    tilawahPages: row[TILAWAH_PAGES_COLUMN] ?? 0,
    zikirCount: row[ZIKIR_COUNT_COLUMN] ?? 0
  };
}

async function getEntry(userId, date) {
  const row = await mutabaahRepository.findByUserAndDate(userId, date);
  return toApiShape(row, userId, date);
}

async function upsertEntry(userId, date, body) {
  const dbFields = {};
  for (const camel of CAMEL_FIELDS) {
    if (typeof body[camel] === 'boolean') dbFields[FIELD_MAP[camel]] = body[camel];
  }
  if (Number.isInteger(body.tilawahPages)) dbFields[TILAWAH_PAGES_COLUMN] = body.tilawahPages;
  if (Number.isInteger(body.zikirCount)) dbFields[ZIKIR_COUNT_COLUMN] = body.zikirCount;
  const row = await mutabaahRepository.upsert(userId, date, dbFields);
  return toApiShape(row, userId, date);
}

async function getSummary(userId, range) {
  const days = range === 'month' ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await mutabaahRepository.findRangeForUser(userId, sinceStr);
  return rows.map((row) => toApiShape(row, userId, row.date));
}

// Per-item "done/total days" totals over an arbitrary [from, to] range, for
// the Checklist page's period view + "Copy" summary.
async function getPeriodTotals(userId, from, to) {
  const totalDays = Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;

  const rows = await mutabaahRepository.findBoundedRangeForUser(userId, from, to);

  const totals = Object.fromEntries(CAMEL_FIELDS.map((camel) => [camel, 0]));
  let tilawahPages = 0;
  let zikirCount = 0;
  rows.forEach((row) => {
    CAMEL_FIELDS.forEach((camel) => {
      if (row[FIELD_MAP[camel]]) totals[camel] += 1;
    });
    tilawahPages += row[TILAWAH_PAGES_COLUMN] || 0;
    zikirCount += row[ZIKIR_COUNT_COLUMN] || 0;
  });

  return { from, to, totalDays, totals, tilawahPages, zikirCount };
}

module.exports = { getEntry, upsertEntry, getSummary, getPeriodTotals, toApiShapePublic: toApiShape };

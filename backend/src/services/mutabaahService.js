const mutabaahRepository = require('../repositories/mutabaahRepository');
const { FIELD_MAP, CAMEL_FIELDS } = require('../models/MutabaahEntry');

function toApiShape(row, userId, date) {
  if (!row) {
    return { userId, date, ...Object.fromEntries(CAMEL_FIELDS.map((f) => [f, false])) };
  }
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    ...Object.fromEntries(CAMEL_FIELDS.map((camel) => [camel, row[FIELD_MAP[camel]]]))
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

module.exports = { getEntry, upsertEntry, getSummary, toApiShapePublic: toApiShape };

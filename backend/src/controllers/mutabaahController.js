const mutabaahService = require('../services/mutabaahService');

async function summary(req, res) {
  const entries = await mutabaahService.getSummary(req.session.userId, req.query.range || 'week');
  res.json(entries);
}

async function getForDate(req, res) {
  const entry = await mutabaahService.getEntry(req.session.userId, req.params.date);
  res.json(entry);
}

async function updateForDate(req, res) {
  const entry = await mutabaahService.upsertEntry(req.session.userId, req.params.date, req.body);
  res.json(entry);
}

module.exports = { summary, getForDate, updateForDate };

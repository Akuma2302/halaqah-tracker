const mutabaahService = require('../services/mutabaahService');

async function summary(req, res) {
  const entries = await mutabaahService.getSummary(req.userId, req.query.range || 'week');
  res.json(entries);
}

async function period(req, res) {
  const { from, to } = req.query;
  if (!from || !to || from > to) {
    return res.status(400).json({ error: 'Provide a valid from/to date range (from must not be after to).' });
  }
  const result = await mutabaahService.getPeriodTotals(req.userId, from, to);
  res.json(result);
}

async function getForDate(req, res) {
  const entry = await mutabaahService.getEntry(req.userId, req.params.date);
  res.json(entry);
}

async function updateForDate(req, res) {
  const entry = await mutabaahService.upsertEntry(req.userId, req.params.date, req.body);
  res.json(entry);
}

module.exports = { summary, period, getForDate, updateForDate };

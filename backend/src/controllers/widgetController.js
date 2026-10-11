const widgetService = require('../services/widgetService');
const agendaService = require('../services/agendaService');

async function getToken(req, res) {
  res.json({ token: await widgetService.getToken(req.userId) });
}

async function rotateToken(req, res) {
  res.json({ token: await widgetService.rotateToken(req.userId) });
}

async function disable(req, res) {
  await widgetService.disable(req.userId);
  res.json({ token: null });
}

// Public: the token itself is the credential.
async function data(req, res) {
  const result = await widgetService.getWidgetData(req.params.token, req.query.tz);
  res.set('Cache-Control', 'no-store');
  if (!result) return res.status(404).json({ error: 'Widget link not found. Create a new one in the app.' });
  if (req.query.format === 'text') return res.type('text/plain').send(result.summary);
  res.json(result);
}

const NOT_FOUND = 'Widget link not found. Create a new one in the app.';

// Public, by token: what is coming up in the timetable, for widget apps.
async function agenda(req, res) {
  const result = await agendaService.getAgenda(req.params.token, req.query.tz);
  res.set('Cache-Control', 'no-store');
  if (!result) return res.status(404).json({ error: NOT_FOUND });
  if (req.query.format === 'text') return res.type('text/plain').send(result.summary);
  res.json(result);
}

// Public, by token: the same as a calendar feed that calendar apps subscribe to.
async function calendar(req, res) {
  const result = await agendaService.getCalendar(req.params.token, req.query.tz);
  if (!result) return res.status(404).type('text/plain').send(NOT_FOUND);
  res.set('Cache-Control', 'no-store');
  res.set('Content-Disposition', 'inline; filename="double-4-flat.ics"');
  res.type('text/calendar; charset=utf-8').send(result);
}

module.exports = { getToken, rotateToken, disable, data, agenda, calendar };

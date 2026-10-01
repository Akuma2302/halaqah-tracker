const widgetService = require('../services/widgetService');

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

module.exports = { getToken, rotateToken, disable, data };

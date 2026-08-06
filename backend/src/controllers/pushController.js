const pushService = require('../services/pushService');

function vapidPublicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, configured: pushService.configured });
}

async function subscribe(req, res) {
  await pushService.subscribe(req.userId, req.body);
  res.status(201).json({ ok: true });
}

async function unsubscribe(req, res) {
  await pushService.unsubscribe(req.body.endpoint);
  res.json({ ok: true });
}

module.exports = { vapidPublicKey, subscribe, unsubscribe };
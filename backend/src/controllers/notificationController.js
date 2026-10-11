const notificationService = require('../services/notificationService');

async function list(req, res) {
  const notifications = await notificationService.listForUser(req.userId);
  res.json(notifications);
}

async function markRead(req, res) {
  const notification = await notificationService.markRead(req.params.id, req.userId);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json(notification);
}

async function markAllRead(req, res) {
  await notificationService.markAllRead(req.userId);
  res.json({ ok: true });
}

module.exports = { list, markRead, markAllRead };

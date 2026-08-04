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

module.exports = { list, markRead };

const notificationRepository = require('../repositories/notificationRepository');
const { serializeNotification } = require('../utils/serializers');

async function notify({ userId, type, title, body, relatedId }) {
  const row = await notificationRepository.create({ userId, type, title, body, relatedId });
  return serializeNotification(row);
}

async function notifyMany(notifications) {
  const rows = await notificationRepository.createMany(notifications);
  return rows.map(serializeNotification);
}

async function listForUser(userId) {
  const rows = await notificationRepository.findByUser(userId);
  return rows.map(serializeNotification);
}

async function markRead(id, userId) {
  const row = await notificationRepository.markRead(id, userId);
  return row ? serializeNotification(row) : null;
}

module.exports = { notify, notifyMany, listForUser, markRead };

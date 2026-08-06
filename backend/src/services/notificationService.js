const notificationRepository = require('../repositories/notificationRepository');
const pushService = require('./pushService');
const { serializeNotification } = require('../utils/serializers');

async function notify({ userId, type, title, body, relatedId }) {
  const row = await notificationRepository.create({ userId, type, title, body, relatedId });
  const notification = serializeNotification(row);

  // Best-effort — a push failure should never break the in-app notification
  // that already succeeded above.
  pushService.pushToUser(userId, { title, body }).catch((err) => console.error('Push error:', err.message));

  return notification;
}

async function notifyMany(notifications) {
  const rows = await notificationRepository.createMany(notifications);
  const serialized = rows.map(serializeNotification);

  serialized.forEach((n) => {
    pushService.pushToUser(n.userId, { title: n.title, body: n.body }).catch((err) => console.error('Push error:', err.message));
  });

  return serialized;
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
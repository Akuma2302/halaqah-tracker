const webpush = require('web-push');
const pushSubscriptionRepository = require('../repositories/pushSubscriptionRepository');

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function subscribe(userId, subscription) {
  await pushSubscriptionRepository.upsert(userId, subscription);
}

async function unsubscribe(endpoint) {
  await pushSubscriptionRepository.removeByEndpoint(endpoint);
}

// Sends a real push message to every device this user has subscribed on.
// This is what makes it show up in the phone's OS notification center, even
// if the app isn't open — a plain `new Notification()` in JS can't do that,
// it only works while a tab is open (see AuthContext.jsx on the frontend).
async function pushToUser(userId, { title, body, url }) {
  if (!configured) return; // VAPID keys not set — push silently disabled, in-app notifications still work

  const subscriptions = await pushSubscriptionRepository.findByUserId(userId);
  if (!subscriptions.length) return;

  const payload = JSON.stringify({ title, body, url: url || '/notifications' });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        // 410/404 means the browser revoked or expired this subscription —
        // clean it up so we stop wasting sends on a dead device.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pushSubscriptionRepository.removeByEndpoint(sub.endpoint).catch(() => {});
        } else {
          console.error('Push send error:', err.message);
        }
      }
    })
  );
}

module.exports = { subscribe, unsubscribe, pushToUser, configured };
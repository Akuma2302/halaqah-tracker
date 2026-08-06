import client from './apiClient';

// Web Push's applicationServerKey wants a Uint8Array, but the VAPID public
// key comes over the wire as URL-safe base64 — this converts between them.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Registers the service worker, asks for notification permission, subscribes
// to Web Push, and tells the backend about this device. Safe to call
// whenever — every step feature-detects and silently no-ops if unsupported
// (e.g. iOS Safari when the app hasn't been added to the home screen).
export async function setupPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return; // Not supported on this browser/context at all
  }

  if (typeof Notification === 'undefined') return;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');

    const { data } = await client.get('/push/vapid-public-key');
    if (!data.configured || !data.publicKey) return; // Push not set up on this deployment yet

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });
    }

    await client.post('/push/subscribe', subscription.toJSON());
  } catch (err) {
    // Best-effort — a failed push setup should never block the rest of the app.
    console.warn('Push notification setup failed:', err.message);
  }
}
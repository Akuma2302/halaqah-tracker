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
// to Web Push, and tells the backend about this device.
//
// Returns `true` only if a real push subscription was confirmed end-to-end
// (server has VAPID configured AND accepted this device's subscription).
// Every step logs clearly to the console so a failure can be diagnosed from
// a live deployment without needing to reproduce it locally — check
// DevTools > Console and look for lines starting with "[push]".
export async function setupPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[push] Not supported in this browser/context (e.g. iOS Safari not added to Home Screen yet).');
    return false;
  }

  if (typeof Notification === 'undefined') {
    console.log('[push] Notification API unavailable.');
    return false;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    console.log('[push] Permission prompt result:', permission);
    if (permission !== 'granted') return false;
  }
  if (Notification.permission !== 'granted') {
    console.log('[push] Notification permission is', Notification.permission, '- not proceeding.');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[push] Service worker registered:', registration.scope);

    const { data } = await client.get('/push/vapid-public-key');
    console.log('[push] Backend VAPID config:', data);
    if (!data.configured || !data.publicKey) {
      console.log('[push] Backend has no VAPID keys set (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars on Render) - push disabled server-side.');
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });
      console.log('[push] Created new push subscription.');
    } else {
      console.log('[push] Reusing existing push subscription.');
    }

    await client.post('/push/subscribe', subscription.toJSON());
    console.log('[push] Subscription sent to backend successfully. Push notifications are live for this device.');
    return true;
  } catch (err) {
    console.warn('[push] Setup failed:', err);
    return false;
  }
}

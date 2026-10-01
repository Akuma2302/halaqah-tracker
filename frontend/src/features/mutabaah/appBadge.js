import { MUTABAAH_FIELDS } from './mutabaahFields';

// Shows how many of today's items are left as a number on the installed
// app's icon (iOS 16.4+ home-screen apps with notifications allowed, and
// desktop/Android installs where the Badging API is supported). No-op elsewhere.
export function updateAppBadge(todayEntry) {
  if (!todayEntry || typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
  const remaining = MUTABAAH_FIELDS.filter((f) => !todayEntry[f.key]).length;
  const result = remaining > 0 ? navigator.setAppBadge(remaining) : navigator.clearAppBadge();
  result?.catch?.(() => {});
}

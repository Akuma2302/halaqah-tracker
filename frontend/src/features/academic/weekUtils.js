// Sunday -> Saturday weeks, matching backend/src/utils/weekUtils.js. Uses
// local calendar math (not UTC-string parsing) so "today" always matches
// what the user actually sees on their device, but the Y-M-D keys produced
// are plain calendar dates with no timezone attached — so they compare
// identically once sent to the backend.
function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatWeekLabel(weekStartKey) {
  const [y, m, d] = weekStartKey.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = addDays(start, 6);
  const fmt = (dt) => dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Recent weeks first (current week at top), going back `pastWeeks`.
export function generateWeekOptions(pastWeeks = 12) {
  const currentWeekStart = getWeekStart();
  const weeks = [];
  for (let i = 0; i < pastWeeks; i++) {
    const start = addDays(currentWeekStart, -7 * i);
    const key = toDateKey(start);
    weeks.push({ value: key, label: `${formatWeekLabel(key)}${i === 0 ? ' (This week)' : ''}` });
  }
  return weeks;
}

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dateForDayInWeek(weekStartKey, dayIndex) {
  const [y, m, d] = weekStartKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), dayIndex));
}

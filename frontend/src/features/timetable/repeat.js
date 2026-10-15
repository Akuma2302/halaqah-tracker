// How a repeating timetable entry falls on dates (the same rule as the
// server's utils/weekly.js). By default every week on its weekday; a custom
// one repeats every N days, weeks, months or years from `repeatFrom`, may end
// on `repeatUntil` (also set for "after N times"), and can have single dates
// taken off it (`skipDates`).

import { DAYS } from './timetable';

export const REPEAT_UNITS = [
  ['day', 'day', 'days'],
  ['week', 'week', 'weeks'],
  ['month', 'month', 'months'],
  ['year', 'year', 'years']
];

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (key) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const weekday = (key) => new Date(utc(key)).getUTCDay();
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);

// Whether the rule alone (every N units from a date, on a weekday) lands on a date.
export function ruleOn({ every = 1, unit = 'week', from = null, dayOfWeek }, date) {
  const n = Math.max(1, Number(every) || 1);
  if (from && date < from) return false;
  if (unit === 'day') return !from || Math.round((utc(date) - utc(from)) / DAY_MS) % n === 0;
  if (unit === 'month' || unit === 'year') {
    if (!from) return false;
    if (date.slice(8, 10) !== from.slice(8, 10)) return false;
    const months = (Number(date.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(date.slice(5, 7)) - Number(from.slice(5, 7)));
    if (unit === 'year') return date.slice(5, 7) === from.slice(5, 7) && (months / 12) % n === 0;
    return months % n === 0;
  }
  if (weekday(date) !== dayOfWeek) return false;
  if (n === 1 || !from) return true;
  const sunday = (key) => utc(key) - weekday(key) * DAY_MS;
  return Math.round((sunday(date) - sunday(from)) / (7 * DAY_MS)) % n === 0;
}

// Whether a repeating entry happens on a date.
export function repeatsOn(entry, date) {
  if ((entry.skipDates || []).includes(date)) return false;
  if (entry.repeatUntil && date > entry.repeatUntil) return false;
  return ruleOn({ every: entry.repeatEvery, unit: entry.repeatUnit || 'week', from: entry.repeatFrom || null, dayOfWeek: entry.dayOfWeek }, date);
}

// "After N times": the date of the Nth time, counting every chosen weekday
// (for weeks) from the start. Looks up to ten years ahead.
export function lastOfCount({ every, unit, from, days }, count) {
  let seen = 0;
  for (let ms = utc(from), i = 0; i < 3700; i += 1, ms += DAY_MS) {
    const date = keyOf(ms);
    const hit = unit === 'week' ? days.some((d) => ruleOn({ every, unit, from, dayOfWeek: d }, date)) : ruleOn({ every, unit, from }, date);
    if (hit && (seen += 1) === count) return date;
  }
  return null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const listDays = (days) => {
  const names = [...days].sort().map((d) => DAYS[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
};
const short = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// A rule in words: "Weekly on Tuesday", "Every 2 weeks on Tuesday and
// Thursday", "Daily", "Every 3 days", "Monthly on day 14", "Annually on
// 14 October", with ", until 14 Jan 2027" or ", 13 times".
export function ruleText({ every = 1, unit = 'week', from, days = [], until, count }) {
  const n = Math.max(1, Number(every) || 1);
  const d = from ? Number(from.slice(8, 10)) : null;
  let text;
  if (unit === 'day') text = n === 1 ? 'Daily' : `Every ${n} days`;
  else if (unit === 'month') text = `${n === 1 ? 'Monthly' : `Every ${n} months`}${d ? ` on day ${d}` : ''}`;
  else if (unit === 'year') text = `${n === 1 ? 'Annually' : `Every ${n} years`}${from ? ` on ${d} ${MONTHS[Number(from.slice(5, 7)) - 1]}` : ''}`;
  else text = `${n === 1 ? 'Weekly' : `Every ${n} weeks`}${days.length ? ` on ${listDays(days)}` : ''}`;
  if (count) return `${text}, ${count} time${count === 1 ? '' : 's'}`;
  if (until) return `${text}, until ${short(until)}`;
  return text;
}

// The rule of an entry as it is stored, in words.
export const entryRuleText = (entry) =>
  ruleText({
    every: entry.repeatEvery,
    unit: entry.repeatUnit || 'week',
    from: entry.repeatFrom,
    days: [entry.dayOfWeek],
    until: entry.repeatUntil,
    count: entry.repeatCount
  });

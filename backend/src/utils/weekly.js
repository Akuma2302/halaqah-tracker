// How a repeating timetable entry falls on dates.
//
// By default an entry repeats every week on its weekday. A custom one repeats
// every N days, weeks, months or years from `repeat_from`; it may end on a
// date (`repeat_until`, also set for "after N times"), and single dates can
// be taken off it (`skip_dates`, "delete this event").

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (value) => (value ? String(value).slice(0, 10) : null);
const utc = (key) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const weekday = (key) => new Date(utc(key)).getUTCDay();

function skipDatesOf(row) {
  return Array.isArray(row.skip_dates) ? row.skip_dates : [];
}

// Not taken off this date, and not ended before it.
function weeklyOn(row, date) {
  const until = dayKey(row.repeat_until);
  return !skipDatesOf(row).includes(date) && (!until || date <= until);
}

// Whether the rule alone (every N units from a date, on a weekday) lands on a date.
function ruleOn({ every = 1, unit = 'week', from = null, dayOfWeek }, date) {
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
  // Weeks: on its weekday, every N weeks counted from the week of `from`.
  if (weekday(date) !== dayOfWeek) return false;
  if (n === 1 || !from) return true;
  const sunday = (key) => utc(key) - weekday(key) * DAY_MS;
  return Math.round((sunday(date) - sunday(from)) / (7 * DAY_MS)) % n === 0;
}

// Whether a repeating entry (not a one-off) happens on a date ("YYYY-MM-DD").
function occursOn(row, date) {
  if (row.start_date) return false;
  return (
    weeklyOn(row, date) &&
    ruleOn({ every: row.repeat_every, unit: row.repeat_unit || 'week', from: dayKey(row.repeat_from), dayOfWeek: row.day_of_week }, date)
  );
}

module.exports = { weeklyOn, occursOn, ruleOn, skipDatesOf, dayKey };

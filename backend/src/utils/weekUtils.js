// Every "week" in the Academic Journal runs Sunday -> Saturday. This is the
// single source of truth for turning any date into the Sunday that starts
// its week, so the ring chart, weekly logs, and report all agree.

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(dateInput) {
  const d = new Date(`${dateInput}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  return toDateKey(d);
}

function getWeekEnd(weekStart) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return toDateKey(d);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

module.exports = { toDateKey, getWeekStart, getWeekEnd, addDays };

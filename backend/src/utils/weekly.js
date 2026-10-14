// A weekly timetable entry can be taken off single dates ("this event") and
// ended from a date onwards ("this and following events").

const dayKey = (value) => (value ? String(value).slice(0, 10) : null);

function skipDatesOf(row) {
  return Array.isArray(row.skip_dates) ? row.skip_dates : [];
}

// Whether a weekly entry happens on this date ("YYYY-MM-DD").
function weeklyOn(row, date) {
  const until = dayKey(row.repeat_until);
  return !skipDatesOf(row).includes(date) && (!until || date <= until);
}

module.exports = { weeklyOn, skipDatesOf, dayKey };

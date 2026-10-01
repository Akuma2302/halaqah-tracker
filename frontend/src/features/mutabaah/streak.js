import dayjs from 'dayjs';
import { MUTABAAH_FIELDS } from './mutabaahFields';

function hasAmal(entry) {
  return !!entry && MUTABAAH_FIELDS.some((f) => entry[f.key]);
}

// Consecutive days, ending today, with at least one item ticked. If today has
// nothing yet, the streak counts back from yesterday, so it isn't shown as
// broken before the user has had a chance to start the day.
export function currentStreak(entries, today = dayjs()) {
  const byDate = Object.fromEntries(entries.map((e) => [e.date, e]));
  let day = hasAmal(byDate[today.format('YYYY-MM-DD')]) ? today : today.subtract(1, 'day');
  let streak = 0;
  while (hasAmal(byDate[day.format('YYYY-MM-DD')])) {
    streak += 1;
    day = day.subtract(1, 'day');
  }
  return streak;
}

// e.g. "19 Rabiʻ II 1448 AH". Uses the Umm al-Qura calendar, which can differ
// by a day from local (e.g. JAKIM) announcements. Null if the browser lacks it.
export function hijriDate(date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!fmt.resolvedOptions().calendar.startsWith('islamic')) return null;
    return fmt.format(date);
  } catch {
    return null;
  }
}

// Shared by the Timetable page and the subject editor's "Class times".
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Kinds of timetable entry, as [value, label]. Matches KINDS in
// backend/src/routes/timetable.js. Class kinds are set on a subject's class
// times; task kinds are what you add in the Timetable itself.
export const CLASS_KINDS = [
  ['class', 'Class'],
  ['lecture', 'Lecture'],
  ['tutorial', 'Tutorial'],
  ['lab', 'Lab']
];
export const TASK_KINDS = [
  ['study', 'Study hour'],
  ['meeting', 'Meeting'],
  ['halaqah', 'Halaqah'],
  ['other', 'Other']
];
export const KINDS = [...CLASS_KINDS, ...TASK_KINDS];
export const KIND_LABEL = Object.fromEntries(KINDS);

// "14:30" -> 870
export function minutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// "14:30" -> "2:30 pm"
export function clock(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// A subject's class slots as one line: "Mon 9:00 am · Wed 2:00 pm".
export function slotSummary(entries) {
  return [...entries]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
    .map((e) => `${SHORT_DAYS[e.dayOfWeek]} ${clock(e.startTime)}`)
    .join(' · ');
}

// A steady colour per class (from its name), so the same subject looks the
// same on every day.
export function hueFor(text) {
  let sum = 0;
  for (const ch of text || '') sum = (sum * 31 + ch.charCodeAt(0)) % 360;
  return sum;
}

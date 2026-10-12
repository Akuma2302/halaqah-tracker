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

// What an entry is called by type: the user's own type if it has one.
export const kindLabel = (entry) => entry?.customKind || KIND_LABEL[entry?.kind] || entry?.kind || 'Task';

// Reminders are kept as minutes before the start; the form shows them as a
// number and a unit.
export const REMINDER_UNITS = [
  ['m', 'minutes', 1],
  ['h', 'hours', 60],
  ['d', 'days', 1440],
  ['w', 'weeks', 10080]
];
const UNIT_MINUTES = Object.fromEntries(REMINDER_UNITS.map(([key, , mins]) => [key, mins]));
export const MAX_REMINDERS = 5;
export const MAX_REMINDER_MINUTES = 40320; // four weeks

// 90 -> { n: 90, unit: 'm' }, 120 -> { n: 2, unit: 'h' }, 1440 -> { n: 1, unit: 'd' }
export function reminderParts(mins) {
  const unit = [...REMINDER_UNITS].reverse().find(([, , size]) => mins > 0 && mins % size === 0);
  return unit ? { n: mins / unit[2], unit: unit[0] } : { n: mins, unit: 'm' };
}
export const reminderMinutes = ({ n, unit }) => Math.round(Number(n) * UNIT_MINUTES[unit]);

// 0 -> "At the start", 10 -> "10 minutes before", 1440 -> "1 day before"
export function reminderText(mins) {
  if (!mins) return 'At the start';
  const { n, unit } = reminderParts(mins);
  const word = REMINDER_UNITS.find(([key]) => key === unit)[1];
  return `${n} ${n === 1 ? word.slice(0, -1) : word} before`;
}

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

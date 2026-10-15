const timetableRepository = require('../repositories/timetableRepository');
const mentoringGroupRepository = require('../repositories/mentoringGroupRepository');
const { asRow: groupMeetingRow } = require('./groupMeetings');
const { occursOn } = require('../utils/weekly');
const reminderLogRepository = require('../repositories/reminderLogRepository');
const notificationService = require('./notificationService');
const { localClock } = require('./mutabaahReminderService');
const { zonedToUtc } = require('./agendaService');
const { clock } = require('../utils/assessments');

// Reminders people set on their own timetable entries: "10 minutes before",
// "1 day before" and so on, as many as they like on each one. Sent to whoever
// owns the entry and everyone added to it. A mentoring group's weekly meeting
// works the same way: its mentor sets the reminders, and they go to the mentor
// and everyone in the group.
//
// The job runs every ten minutes, so a reminder arrives within about ten
// minutes after its moment, never before it.

const TIME_ZONE = process.env.MUTABAAH_TIME_ZONE || 'Asia/Kuala_Lumpur';
// A reminder whose moment passed more than this long ago is skipped rather
// than sent late (e.g. "1 week before" set on something happening tomorrow).
const LATE_LIMIT_MS = 60 * 60 * 1000;
// Weekly entries are looked at this many days ahead: the longest reminder is 4 weeks.
const LOOK_AHEAD_DAYS = 29;

const hhmm = (time) => String(time).slice(0, 5);

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "in 10 minutes", "in 2 hours", "tomorrow", "in 3 days", "now"
function fromNow(ms) {
  const mins = Math.round(ms / 60000);
  if (mins <= 1) return 'now';
  if (mins < 60) return `in ${mins} minutes`;
  // Just under a day reads as "tomorrow", not "in 24 hours".
  if (mins < 23.5 * 60) {
    const hours = Math.round(mins / 60);
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(mins / (24 * 60));
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

// The dates an entry starts on that could still have a reminder to send: its
// own date if it has one, otherwise its weekday over the coming weeks.
function startDates(row, today) {
  if (row.start_date) return [row.start_date];
  const dates = [];
  for (let i = 0; i <= LOOK_AHEAD_DAYS; i += 1) {
    const date = addDays(today, i);
    if (occursOn(row, date)) dates.push(date);
  }
  return dates;
}

// The reminders due at `now` for these entries, as { row, date, minutes, start }.
function dueReminders(rows, now, timeZone = TIME_ZONE) {
  const { date: today } = localClock(now, timeZone);
  const due = [];
  rows.forEach((row) => {
    const reminders = Array.isArray(row.reminders) ? row.reminders : [];
    startDates(row, today).forEach((date) => {
      const start = zonedToUtc(date, hhmm(row.start_time), timeZone);
      reminders.forEach((minutes) => {
        const at = start.getTime() - minutes * 60000;
        const late = now.getTime() - at;
        // "At the start" (0 minutes) may be up to ten minutes after it began.
        const stillAhead = now.getTime() < start.getTime() || (minutes === 0 && late < 10 * 60000);
        if (late >= 0 && late <= LATE_LIMIT_MS && stillAhead) due.push({ row, date, minutes, start });
      });
    });
  });
  return due;
}

const KIND_LABEL = { class: 'Class', lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab', study: 'Study hour', meeting: 'Meeting', halaqah: 'Halaqah', other: 'Task' };
const nameOf = (row) => row.title || row.subject?.name || row.custom_kind || KIND_LABEL[row.kind] || 'Task';

// Safe to call as often as you like: each reminder is sent at most once.
async function runDueReminders(now = new Date()) {
  const result = { sent: 0 };
  const [entries, groups] = await Promise.all([timetableRepository.findWithReminders(), mentoringGroupRepository.findWithReminders()]);
  const rows = [...entries.filter((row) => row.subject?.is_visible !== false), ...groups.map(groupMeetingRow).filter(Boolean)];
  const due = dueReminders(rows, now);
  if (!due.length) return result;

  // People added to an entry; a group meeting's people are its members.
  const links = await timetableRepository.findParticipants([...new Set(due.filter((d) => !d.row.from_group).map((d) => d.row.id))]);
  const wanted = [];
  due.forEach(({ row, date, minutes, start }) => {
    const people = [row.user_id, ...(row.from_group ? row.member_ids : links.filter((l) => l.entry_id === row.id).map((l) => l.user_id))];
    const when = fromNow(start.getTime() - now.getTime());
    [...new Set(people)].forEach((userId) =>
      wanted.push({
        userId,
        key: `tt:${row.id}:${date}:${minutes}`,
        type: 'reminder',
        title: when === 'now' ? `${nameOf(row)} is starting` : `${nameOf(row)} ${when}`,
        body: [`Starts at ${clock(hhmm(row.start_time))}`, row.venue].filter(Boolean).join(' · '),
        relatedId: row.id
      })
    );
  });

  const claimed = await reminderLogRepository.claimAssessment(wanted.map((w) => ({ user_id: w.userId, key: w.key })));
  const mine = new Set(claimed.map((c) => `${c.user_id}|${c.key}`));
  const toSend = wanted.filter((w) => mine.has(`${w.userId}|${w.key}`));
  await notificationService.notifyMany(toSend);
  result.sent = toSend.length;
  return result;
}

module.exports = { runDueReminders, dueReminders, fromNow };

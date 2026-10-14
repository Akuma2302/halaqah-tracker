const timetableRepository = require('../repositories/timetableRepository');
const subjectRepository = require('../repositories/subjectRepository');
const widgetService = require('./widgetService');
const { groupMeetingRows } = require('./groupMeetings');
const { ASSESSMENT_LABEL, isExam, clock } = require('../utils/assessments');

// What is coming up, for things outside the app that can't sign in: a JSON
// agenda for home-screen widget apps, and a calendar feed (.ics) that Google
// Calendar, Apple Calendar and others can subscribe to. Both are read with
// the user's private widget token.

const KIND_LABEL = {
  class: 'Class',
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  lab: 'Lab',
  study: 'Study hour',
  meeting: 'Meeting',
  halaqah: 'Halaqah',
  other: 'Task'
};
const CLASS_KINDS = ['class', 'lecture', 'tutorial', 'lab'];
const AGENDA_DAYS = 14;

const hhmm = (time) => (time ? String(time).slice(0, 5) : '');
const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();
const subjectText = (s) => (s?.code ? `${s.name} (${s.code})` : s?.name || '');

// The weekly timetable (own entries and ones shared with the user) and the
// subjects with their assessments and tasks.
async function load(userId) {
  const [own, shared, subjects, meetings] = await Promise.all([
    timetableRepository.findByUser(userId),
    timetableRepository.findSharedWith(userId),
    subjectRepository.findVisibleForUser(userId),
    groupMeetingRows(userId)
  ]);
  // Classes of a hidden subject are left out, as its exams and due dates already are.
  // The mentoring group's weekly meeting comes in like any weekly entry.
  return { entries: [...own, ...shared, ...meetings].filter((row) => row.subject?.is_visible !== false), subjects };
}

// One-off dated things from the subjects: exams, due dates, and tasks that
// were given a time. Finished ones are left out.
function datedItems(subjects) {
  const items = [];
  subjects.forEach((s) => {
    (s.subject_assessments || []).forEach((a) => {
      if (a.is_done) return;
      const label = ASSESSMENT_LABEL[a.type] || a.type;
      if (a.due_date) {
        const exam = isExam(a.type);
        items.push({
          uid: `assessment-${a.id}`,
          date: a.due_date,
          time: hhmm(a.due_time),
          minutes: exam ? 60 : 0,
          title: exam ? `${label}: ${s.name}` : `${label} due: ${s.name}`,
          detail: [subjectText(s), a.focus_topics ? `Focus: ${a.focus_topics}` : '', a.note].filter(Boolean).join(' · '),
          kind: exam ? 'exam' : 'due'
        });
      }
      (Array.isArray(a.tasks) ? a.tasks : []).forEach((t, i) => {
        if (t.isDone || !t.dueDate || !t.dueTime) return;
        items.push({
          uid: `task-${a.id}-${i}`,
          date: t.dueDate,
          time: hhmm(t.dueTime),
          minutes: 30,
          title: t.title,
          detail: `For ${label} · ${subjectText(s)}`,
          kind: 'task'
        });
      });
    });
  });
  return items;
}

function entryTitle(row) {
  return row.title || row.subject?.name || row.custom_kind || KIND_LABEL[row.kind] || 'Class';
}

function entryDetail(row) {
  return [row.subject?.code, row.custom_kind || KIND_LABEL[row.kind] || row.kind, row.venue].filter(Boolean).join(' · ');
}

// The next two weeks, day by day: the weekly timetable laid onto real dates,
// plus the dated items. All-day things come first on their day.
async function getAgenda(token, tz) {
  const user = await widgetService.userForToken(token);
  if (!user) return null;
  const timeZone = widgetService.resolveTimeZone(tz);
  const today = widgetService.localDate(new Date(), timeZone);
  const last = widgetService.shiftDate(today, AGENDA_DAYS - 1);
  const { entries, subjects } = await load(user.id);

  const events = [];
  for (let i = 0; i < AGENDA_DAYS; i += 1) {
    const date = widgetService.shiftDate(today, i);
    entries
      // Weekly entries on their weekday; a one-off event on each day it covers.
      .filter((row) => (row.start_date ? date >= row.start_date && date <= (row.end_date || row.start_date) : row.day_of_week === weekdayOf(date)))
      .forEach((row) =>
        events.push({
          date,
          // An event over several days: its start time on the first day, its
          // end time on the last, and all day in between.
          time: row.start_date && date !== row.start_date ? '' : hhmm(row.start_time),
          end: row.start_date && date !== (row.end_date || row.start_date) ? '' : hhmm(row.end_time),
          allDay: !!row.start_date && date !== row.start_date,
          title: entryTitle(row),
          detail: entryDetail(row),
          kind: CLASS_KINDS.includes(row.kind) ? 'class' : 'task'
        })
      );
  }
  datedItems(subjects)
    .filter((item) => item.date >= today && item.date <= last)
    .forEach((item) => events.push({ date: item.date, time: item.time, end: '', allDay: !item.time, title: item.title, detail: item.detail, kind: item.kind }));
  events.sort((a, b) => `${a.date}${a.time || '00:00'}`.localeCompare(`${b.date}${b.time || '00:00'}`));

  const line = (e) => `${e.allDay ? 'All day' : clock(e.time)} ${e.title}`;
  const todays = events.filter((e) => e.date === today);
  const tomorrow = widgetService.shiftDate(today, 1);
  return {
    name: user.name.split(' ')[0],
    date: today,
    timeZone,
    events,
    // Plain text for widget apps that can only show a string (KWGT on Android).
    summary: todays.length ? todays.map(line).join('\n') : 'Nothing on today',
    tomorrow:
      events
        .filter((e) => e.date === tomorrow)
        .map(line)
        .join('\n') || 'Nothing on tomorrow',
    generatedAt: new Date().toISOString()
  };
}

// ---------- calendar feed ----------

// Local wall-clock time in `timeZone` -> the same instant in UTC.
function zonedToUtc(dateKey, time, timeZone) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value])
  );
  const seen = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (seen - guess));
}

const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dayStamp = (dateKey) => dateKey.replace(/-/g, '');
const escapeText = (text) =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Lines longer than 75 bytes are folded, as the format requires.
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

function vevent(fields) {
  return ['BEGIN:VEVENT', ...fields.filter(Boolean), 'END:VEVENT'].map(fold).join('\r\n');
}

// Everything as a calendar: each weekly timetable entry as a repeating event,
// and each exam, due date and timed task as a single one.
async function getCalendar(token, tz) {
  const user = await widgetService.userForToken(token);
  if (!user) return null;
  const timeZone = widgetService.resolveTimeZone(tz);
  const today = widgetService.localDate(new Date(), timeZone);
  const { entries, subjects } = await load(user.id);
  const now = stamp(new Date());

  const events = entries.map((row) => {
    // A one-off event: a single entry from its start to its end.
    if (row.start_date) {
      return vevent([
        `UID:timetable-${row.id}@double4flat`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(zonedToUtc(row.start_date, hhmm(row.start_time), timeZone))}`,
        `DTEND:${stamp(zonedToUtc(row.end_date || row.start_date, hhmm(row.end_time), timeZone))}`,
        `SUMMARY:${escapeText(entryTitle(row))}`,
        entryDetail(row) && `DESCRIPTION:${escapeText(entryDetail(row))}`,
        row.venue && `LOCATION:${escapeText(row.venue)}`
      ]);
    }
    // The first one falls in the current week, so it shows straight away.
    const first = widgetService.shiftDate(today, (row.day_of_week - weekdayOf(today) + 7) % 7);
    return vevent([
      `UID:timetable-${row.id}@double4flat`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(zonedToUtc(first, hhmm(row.start_time), timeZone))}`,
      `DTEND:${stamp(zonedToUtc(first, hhmm(row.end_time), timeZone))}`,
      'RRULE:FREQ=WEEKLY',
      `SUMMARY:${escapeText(entryTitle(row))}`,
      entryDetail(row) && `DESCRIPTION:${escapeText(entryDetail(row))}`,
      row.venue && `LOCATION:${escapeText(row.venue)}`
    ]);
  });

  datedItems(subjects)
    .filter((item) => item.date >= widgetService.shiftDate(today, -30))
    .forEach((item) => {
      const start = item.time ? zonedToUtc(item.date, item.time, timeZone) : null;
      events.push(
        vevent([
          `UID:${item.uid}@double4flat`,
          `DTSTAMP:${now}`,
          start ? `DTSTART:${stamp(start)}` : `DTSTART;VALUE=DATE:${dayStamp(item.date)}`,
          start
            ? `DTEND:${stamp(new Date(start.getTime() + item.minutes * 60000))}`
            : `DTEND;VALUE=DATE:${dayStamp(widgetService.shiftDate(item.date, 1))}`,
          `SUMMARY:${escapeText(item.title)}`,
          item.detail && `DESCRIPTION:${escapeText(item.detail)}`
        ])
      );
    });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Double 4 Flat//Halaqah Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Double 4 Flat',
    `X-WR-TIMEZONE:${timeZone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

module.exports = { getAgenda, getCalendar, zonedToUtc };

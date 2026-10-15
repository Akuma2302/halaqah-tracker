const router = require('express').Router();
const { z } = require('zod');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const timetableRepository = require('../repositories/timetableRepository');
const subjectRepository = require('../repositories/subjectRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('../services/notificationService');
const { parseMemberNo } = require('../services/mentoringService');
const { groupMeetingRows } = require('../services/groupMeetings');
const { skipDatesOf, dayKey } = require('../utils/weekly');
const { serializeUser } = require('../utils/serializers');
const { clock } = require('../utils/assessments');
const serialize = timetableRepository.serialize;

// Class kinds come from a subject's class times; the rest are tasks added in the Timetable.
const KINDS = ['class', 'lecture', 'tutorial', 'lab', 'study', 'meeting', 'halaqah', 'other'];
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
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();
// Characters that mean something in a search pattern are dropped from what people type.
const cleanText = (text) =>
  String(text || '')
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
const kindsSchema = z.object({ kinds: z.array(z.string().trim().min(1).max(30)).max(12) });
// A colour per type, as a hue: built-in types by their key ("study"), my own as "my:Name".
const colorsSchema = z.object({
  colors: z
    .record(z.string().min(1).max(40), z.number().int().min(0).max(359))
    .refine((c) => Object.keys(c).length <= 40, { message: 'Too many colours' })
});

// A weekly slot: a day (0 = Sunday), a start and end time ("HH:MM", 24h),
// and either one of the user's subjects or a free-text title (or both).
// With `startDate` it is a one-off event instead, from that date and start
// time to `endDate` and the end time. `reminders` are minutes before the
// start; `customKind` is the user's own type for kind 'other'.
// `memberIds` are the User IDs of other people to add; left out, whoever is
// on it already stays.
const entrySchema = z
  .object({
    subjectId: z.string().uuid().nullish(),
    title: z.string().trim().max(80).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(TIME, 'Start time must be HH:MM'),
    endTime: z.string().regex(TIME, 'End time must be HH:MM'),
    startDate: z.string().regex(DATE, 'Start date must be a date').nullish(),
    endDate: z.string().regex(DATE, 'End date must be a date').nullish(),
    venue: z.string().trim().max(80).optional(),
    kind: z.enum(KINDS).optional(),
    customKind: z.string().trim().max(30).optional(),
    // Up to five, each at most four weeks ahead.
    reminders: z.array(z.number().int().min(0).max(40320)).max(5).optional(),
    // A custom repeat: every N days, weeks, months or years from a date, until
    // a date or for N times (the app works out that last date).
    repeatEvery: z.number().int().min(1).max(99).optional(),
    repeatUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
    repeatFrom: z.string().regex(DATE).nullish(),
    repeatUntil: z.string().regex(DATE).nullish(),
    repeatCount: z.number().int().min(1).max(999).nullish(),
    memberIds: z.array(z.string().trim().max(20)).max(20).optional()
  })
  .refine((e) => e.startDate || e.dayOfWeek !== undefined, { message: 'Choose a day or a date' })
  .refine((e) => !e.startDate || (e.endDate || e.startDate) >= e.startDate, { message: 'The end date must not be before the start date' })
  // On one day the end must come after the start; across days any times will do.
  .refine((e) => (e.startDate && (e.endDate || e.startDate) > e.startDate) || e.endTime > e.startTime, { message: 'End time must be after the start time' })
  // A dated event sits on the weekday of its start date.
  .transform((e) => ({
    ...e,
    dayOfWeek: e.startDate ? weekdayOf(e.startDate) : e.dayOfWeek,
    reminders: e.reminders ? [...new Set(e.reminders)].sort((a, b) => a - b) : undefined
  }))
  .refine((e) => e.subjectId || (e.title && e.title.length > 0), { message: 'Choose a subject or give it a name' });

const person = (row) => {
  const { _id, memberId, name } = serializeUser(row);
  return { _id, memberId, name };
};

// Adds who owns each entry, who else is on it, and whether it is someone
// else's (`shared`) from the viewer's side.
async function decorate(rows, viewerId) {
  // A mentoring group's meeting isn't a stored entry, so it has no one added to it.
  const links = await timetableRepository.findParticipants(rows.filter((r) => !r.from_group).map((r) => r.id));
  const users = await userRepository.findByIds([...new Set([...rows.map((r) => r.user_id), ...links.map((l) => l.user_id)])]);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((row) => ({
    ...serialize(row),
    shared: row.user_id !== viewerId,
    // A mentoring group's meeting: set by the mentor in Mentoring, not edited here.
    fromGroup: !!row.from_group,
    owner: userById[row.user_id] ? person(userById[row.user_id]) : null,
    participants: links
      .filter((l) => l.entry_id === row.id && userById[l.user_id])
      .map((l) => person(userById[l.user_id]))
      .sort((a, b) => a.name.localeCompare(b.name))
  }));
}

// A subject id from the client must be one of the user's own subjects.
async function ownSubject(req, res) {
  if (!req.body.subjectId) return true;
  if (await subjectRepository.findById(req.body.subjectId, req.userId)) return true;
  res.status(404).json({ error: 'Subject not found' });
  return false;
}

// User IDs ("D4F-0008") -> user rows. Sends the 400 itself and returns null
// when one of them isn't a real user.
async function resolvePeople(req, res) {
  if (req.body.memberIds === undefined) return undefined;
  const people = [];
  for (const raw of [...new Set(req.body.memberIds.filter(Boolean))]) {
    const memberNo = parseMemberNo(raw);
    const user = memberNo === null ? null : await userRepository.findByMemberNo(memberNo);
    if (!user) {
      res.status(400).json({ error: `No user has the ID ${raw}` });
      return null;
    }
    if (user.id !== req.userId && !people.some((p) => p.id === user.id)) people.push(user);
  }
  return people;
}

// Sets who is on the entry and tells anyone newly added, in-app and by push.
async function applyPeople(req, row, people) {
  if (people === undefined) return;
  const before = new Set((await timetableRepository.findParticipants([row.id])).map((l) => l.user_id));
  await timetableRepository.setParticipants(
    row.id,
    people.map((p) => p.id)
  );
  const added = people.filter((p) => !before.has(p.id));
  if (!added.length) return;

  const owner = await userRepository.findById(req.userId);
  const name = row.title || row.subject?.name || row.custom_kind || KIND_LABEL[row.kind] || 'a task';
  const from = clock(String(row.start_time).slice(0, 5));
  const to = clock(String(row.end_time).slice(0, 5));
  const dateText = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const when = !row.start_date
    ? `${DAYS[row.day_of_week]}s, ${from} to ${to}`
    : row.end_date && row.end_date !== row.start_date
      ? `${dateText(row.start_date)} ${from} to ${dateText(row.end_date)} ${to}`
      : `${dateText(row.start_date)}, ${from} to ${to}`;
  const notifications = await notificationService.notifyMany(
    added.map((p) => ({
      userId: p.id,
      type: 'reminder',
      title: `${owner?.name || 'Someone'} added you to ${name}`,
      body: `${row.custom_kind || KIND_LABEL[row.kind] || 'Task'} · ${when}${row.venue ? ` · ${row.venue}` : ''}. It is in your Timetable; open it there to take yourself off.`,
      relatedId: row.id
    }))
  );
  const io = req.app.get('io');
  notifications.forEach((n) => io?.to(`user:${n.userId}`).emit('new-notification', n));
}

router.use(requireAuth);

// My own entries, plus the ones other people have added me to.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [own, shared, meetings] = await Promise.all([
      timetableRepository.findByUser(req.userId),
      timetableRepository.findSharedWith(req.userId),
      groupMeetingRows(req.userId)
    ]);
    res.json(await decorate([...own, ...shared, ...meetings], req.userId));
  })
);

// People to add to a task, found by User ID or by part of their name.
router.get(
  '/people',
  asyncHandler(async (req, res) => {
    const q = cleanText(req.query.q);
    const memberNo = parseMemberNo(q);
    // A name needs two letters, so the whole list of users can't be paged through.
    if (memberNo === null && q.length < 2) return res.json([]);
    const rows = await userRepository.searchPeople({ memberNo, name: q, excludeId: req.userId });
    res.json(rows.map((row) => ({ ...person(row), kampus: row.kampus || '' })));
  })
);

// The user's own task types, offered again each time they add a task.
router.get(
  '/kinds',
  asyncHandler(async (req, res) => {
    const me = await userRepository.findById(req.userId);
    res.json(Array.isArray(me?.task_kinds) ? me.task_kinds : []);
  })
);

router.put(
  '/kinds',
  validate(kindsSchema),
  asyncHandler(async (req, res) => {
    // One of each, whatever the capitals.
    const kinds = req.body.kinds.filter((k, i, all) => all.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i);
    await userRepository.update(req.userId, { task_kinds: kinds });
    res.json(kinds);
  })
);

// The colours the user picked for their types.
router.get(
  '/colors',
  asyncHandler(async (req, res) => {
    const me = await userRepository.findById(req.userId);
    res.json(me?.kind_colors && typeof me.kind_colors === 'object' ? me.kind_colors : {});
  })
);

router.put(
  '/colors',
  validate(colorsSchema),
  asyncHandler(async (req, res) => {
    await userRepository.update(req.userId, { kind_colors: req.body.colors });
    res.json(req.body.colors);
  })
);

router.post(
  '/',
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    if (!(await ownSubject(req, res))) return;
    const people = await resolvePeople(req, res);
    if (people === null) return;
    const row = await timetableRepository.create(req.userId, req.body);
    await applyPeople(req, row, people);
    res.status(201).json((await decorate([row], req.userId))[0]);
  })
);

router.put(
  '/:id',
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    if (!(await ownSubject(req, res))) return;
    const people = await resolvePeople(req, res);
    if (people === null) return;
    const row = await timetableRepository.update(req.params.id, req.userId, req.body);
    if (!row) return res.status(404).json({ error: 'Not found in your timetable' });
    await applyPeople(req, row, people);
    res.json((await decorate([row], req.userId))[0]);
  })
);

// The owner deletes it for everyone; someone who was added only takes themselves off.
// Deleting. Someone added to another person's entry takes themselves off it.
// The owner of a weekly entry can delete one date (?scope=this&date=), that
// date and every later one (?scope=following&date=), or all of it.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await timetableRepository.findById(req.params.id);
    if (row && row.user_id !== req.userId) {
      await timetableRepository.removeParticipant(req.params.id, req.userId);
      return res.json({ ok: true });
    }
    const scope = String(req.query.scope || 'all');
    const date = String(req.query.date || '');
    if (scope !== 'all') {
      if (!['this', 'following'].includes(scope) || !DATE.test(date)) return res.status(400).json({ error: 'Choose which events to delete' });
      if (!row) return res.status(404).json({ error: 'Not found' });
      if (row.start_date) return res.status(400).json({ error: 'Only a weekly entry has other events' });
      if (scope === 'this') {
        const skipDates = [...new Set([...skipDatesOf(row), date])].sort();
        await timetableRepository.setRepeat(row.id, req.userId, { skipDates });
        return res.json({ ok: true, skipDates });
      }
      // The day before the chosen date is the last one it happens.
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const repeatUntil = d.toISOString().slice(0, 10);
      const until = dayKey(row.repeat_until);
      await timetableRepository.setRepeat(row.id, req.userId, { repeatUntil: until && until < repeatUntil ? until : repeatUntil });
      return res.json({ ok: true, repeatUntil: until && until < repeatUntil ? until : repeatUntil });
    }
    await timetableRepository.remove(req.params.id, req.userId);
    res.json({ ok: true });
  })
);

module.exports = router;

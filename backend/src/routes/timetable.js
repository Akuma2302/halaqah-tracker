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

// A weekly slot: a day (0 = Sunday), a start and end time ("HH:MM", 24h),
// and either one of the user's subjects or a free-text title (or both).
// `memberIds` are the User IDs of other people to add; left out, whoever is
// on it already stays.
const entrySchema = z
  .object({
    subjectId: z.string().uuid().nullish(),
    title: z.string().trim().max(80).optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME, 'Start time must be HH:MM'),
    endTime: z.string().regex(TIME, 'End time must be HH:MM'),
    venue: z.string().trim().max(80).optional(),
    kind: z.enum(KINDS).optional(),
    memberIds: z.array(z.string().trim().max(20)).max(20).optional()
  })
  .refine((e) => e.endTime > e.startTime, { message: 'End time must be after the start time' })
  .refine((e) => e.subjectId || (e.title && e.title.length > 0), { message: 'Choose a subject or give it a name' });

const person = (row) => {
  const { _id, memberId, name } = serializeUser(row);
  return { _id, memberId, name };
};

// Adds who owns each entry, who else is on it, and whether it is someone
// else's (`shared`) from the viewer's side.
async function decorate(rows, viewerId) {
  const links = await timetableRepository.findParticipants(rows.map((r) => r.id));
  const users = await userRepository.findByIds([...new Set([...rows.map((r) => r.user_id), ...links.map((l) => l.user_id)])]);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((row) => ({
    ...serialize(row),
    shared: row.user_id !== viewerId,
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
  const name = row.title || row.subject?.name || KIND_LABEL[row.kind] || 'a task';
  const when = `${DAYS[row.day_of_week]}s, ${clock(String(row.start_time).slice(0, 5))} to ${clock(String(row.end_time).slice(0, 5))}`;
  const notifications = await notificationService.notifyMany(
    added.map((p) => ({
      userId: p.id,
      type: 'reminder',
      title: `${owner?.name || 'Someone'} added you to ${name}`,
      body: `${KIND_LABEL[row.kind] || 'Task'} · ${when}${row.venue ? ` · ${row.venue}` : ''}. It is in your Timetable; open it there to take yourself off.`,
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
    const [own, shared] = await Promise.all([timetableRepository.findByUser(req.userId), timetableRepository.findSharedWith(req.userId)]);
    res.json(await decorate([...own, ...shared], req.userId));
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
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await timetableRepository.findById(req.params.id);
    if (row && row.user_id !== req.userId) await timetableRepository.removeParticipant(req.params.id, req.userId);
    else await timetableRepository.remove(req.params.id, req.userId);
    res.json({ ok: true });
  })
);

module.exports = router;

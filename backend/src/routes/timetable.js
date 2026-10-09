const router = require('express').Router();
const { z } = require('zod');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const timetableRepository = require('../repositories/timetableRepository');
const subjectRepository = require('../repositories/subjectRepository');
const serialize = timetableRepository.serialize;

const KINDS = ['class', 'lecture', 'tutorial', 'lab', 'halaqah', 'other'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// A weekly class: a day (0 = Sunday), a start and end time ("HH:MM", 24h),
// and either one of the user's subjects or a free-text title (or both).
const entrySchema = z
  .object({
    subjectId: z.string().uuid().nullish(),
    title: z.string().trim().max(80).optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME, 'Start time must be HH:MM'),
    endTime: z.string().regex(TIME, 'End time must be HH:MM'),
    venue: z.string().trim().max(80).optional(),
    kind: z.enum(KINDS).optional()
  })
  .refine((e) => e.endTime > e.startTime, { message: 'End time must be after the start time' })
  .refine((e) => e.subjectId || (e.title && e.title.length > 0), { message: 'Choose a subject or give the class a name' });

// A subject id from the client must be one of the user's own subjects.
async function ownSubject(req, res) {
  if (!req.body.subjectId) return true;
  if (await subjectRepository.findById(req.body.subjectId, req.userId)) return true;
  res.status(404).json({ error: 'Subject not found' });
  return false;
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json((await timetableRepository.findByUser(req.userId)).map(serialize));
  })
);

router.post(
  '/',
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    if (!(await ownSubject(req, res))) return;
    res.status(201).json(serialize(await timetableRepository.create(req.userId, req.body)));
  })
);

router.put(
  '/:id',
  validate(entrySchema),
  asyncHandler(async (req, res) => {
    if (!(await ownSubject(req, res))) return;
    const row = await timetableRepository.update(req.params.id, req.userId, req.body);
    if (!row) return res.status(404).json({ error: 'Class not found' });
    res.json(serialize(row));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await timetableRepository.remove(req.params.id, req.userId);
    res.json({ ok: true });
  })
);

module.exports = router;

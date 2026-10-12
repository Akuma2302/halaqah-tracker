const router = require('express').Router();
const { z } = require('zod');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const mentoringService = require('../services/mentoringService');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const setMentorSchema = z.object({ memberId: z.string().trim().max(20) });
const groupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(40),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullish(),
  venue: z.string().trim().max(80).optional(),
  memberIds: z.array(z.string().uuid()).max(200).optional()
});
const alertSchema = z.object({
  assessmentId: z.string().uuid(),
  date: z.string().regex(DATE),
  note: z.string().trim().max(200).optional()
});

// The client sends its own "today" and week start, as elsewhere in the API,
// so days line up with the user's timezone rather than the server's.
function dateParam(req, res, name) {
  const value = String(req.query[name] || '');
  if (DATE.test(value)) return value;
  res.status(400).json({ error: `${name} must be a date (YYYY-MM-DD)` });
  return null;
}

router.use(requireAuth);

router.get(
  '/tree',
  asyncHandler(async (req, res) => {
    const date = dateParam(req, res, 'date');
    if (date) res.json(await mentoringService.getTree(req.userId, date));
  })
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const date = dateParam(req, res, 'date');
    const weekStart = date && dateParam(req, res, 'weekStart');
    // ?days=7|14|30 looks back that many days from today instead of at the week.
    const days = [7, 14, 30].includes(Number(req.query.days)) ? Number(req.query.days) : null;
    if (weekStart) res.json(await mentoringService.getDashboard(req.userId, { date, weekStart, days }));
  })
);

router.put(
  '/mentor',
  validate(setMentorSchema),
  asyncHandler(async (req, res) => {
    res.json({ mentor: await mentoringService.setMentor(req.userId, req.body.memberId) });
  })
);

router.get(
  '/mentees/:id',
  asyncHandler(async (req, res) => {
    const date = dateParam(req, res, 'date');
    const weekStart = date && dateParam(req, res, 'weekStart');
    if (weekStart) res.json(await mentoringService.getMenteeDetail(req.userId, req.params.id, { date, weekStart }));
  })
);

// A mentor's own groupings of their mentees, each with a meeting day and time.
router.post(
  '/groups',
  validate(groupSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await mentoringService.saveGroup(req.userId, null, req.body));
  })
);

router.put(
  '/groups/:id',
  validate(groupSchema),
  asyncHandler(async (req, res) => {
    res.json(await mentoringService.saveGroup(req.userId, req.params.id, req.body));
  })
);

router.delete(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    await mentoringService.removeGroup(req.userId, req.params.id);
    res.json({ ok: true });
  })
);

// A mentor reminds a mentee of an upcoming exam or deadline.
router.post(
  '/mentees/:id/alerts',
  validate(alertSchema),
  asyncHandler(async (req, res) => {
    const notification = await mentoringService.alertMentee(req.userId, req.params.id, req.body);
    req.app.get('io')?.to(`user:${notification.userId}`).emit('new-notification', notification);
    res.status(201).json({ ok: true });
  })
);

module.exports = router;

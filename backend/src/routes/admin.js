const router = require('express').Router();
const { z } = require('zod');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const adminService = require('../services/adminService');

// The admin dashboard: supervise everyone who uses the app. Admins only.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  suspended: z.boolean().optional(),
  mentorId: z.string().uuid().nullable().optional(),
  mentoringGroupId: z.string().uuid().nullable().optional()
});

// The admin's own "today" and week start, so days line up with their timezone.
function period(req, res) {
  const date = String(req.query.date || '');
  const weekStart = String(req.query.weekStart || '');
  if (DATE.test(date) && DATE.test(weekStart)) return { date, weekStart };
  res.status(400).json({ error: 'date and weekStart must be dates (YYYY-MM-DD)' });
  return null;
}

router.use(requireAuth, requireAdmin);

router.param('id', (req, res, next, id) => (UUID.test(id) ? next() : res.status(404).json({ error: 'Not found' })));

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const p = period(req, res);
    if (p) res.json(await adminService.getOverview(p));
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const p = period(req, res);
    if (p) res.json(await adminService.listUsers(p));
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const p = period(req, res);
    if (p) res.json(await adminService.getUser(req.params.id, p));
  })
);

router.patch(
  '/users/:id',
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.updateUser(req.userId, req.params.id, req.body);
    // A suspended account is dropped from its open tabs straight away.
    if (result.suspended) req.app.get('io')?.in(`user:${req.params.id}`).disconnectSockets(true);
    res.json({ ok: true });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    await adminService.deleteUser(req.userId, req.params.id);
    req.app.get('io')?.in(`user:${req.params.id}`).disconnectSockets(true);
    res.json({ ok: true });
  })
);

router.get(
  '/past-papers',
  asyncHandler(async (req, res) => {
    res.json(await adminService.listPastPapers());
  })
);

router.delete(
  '/past-papers/:id',
  asyncHandler(async (req, res) => {
    await adminService.removePastPaper(req.params.id);
    res.json({ ok: true });
  })
);

// The mentoring groups mentors have made, to draw each mentor's tree.
router.get(
  '/mentoring-groups',
  asyncHandler(async (req, res) => {
    res.json(await adminService.listMentoringGroups());
  })
);

// Study groups, and one group's chat to read without joining it.
router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    res.json(await adminService.listGroups());
  })
);

router.get(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    res.json(await adminService.getGroup(req.params.id, { before: req.query.before }));
  })
);

module.exports = router;

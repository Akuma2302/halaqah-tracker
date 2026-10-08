const router = require('express').Router();
const { z } = require('zod');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const mentoringService = require('../services/mentoringService');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const setMentorSchema = z.object({ memberId: z.string().trim().max(20) });

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

module.exports = router;

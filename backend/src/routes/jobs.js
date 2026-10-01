const crypto = require('crypto');
const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const { runAllReminders } = require('../jobs/reminderCheck');

// For an external scheduler (e.g. cron-job.org every 10 minutes). Each call
// wakes the Render free-tier server and sends any reminders that are due;
// sending is de-duplicated, so extra calls are harmless. Disabled unless
// CRON_SECRET is set. Pass it as ?key=... or an `x-cron-secret` header.
function secretMatches(given) {
  const expected = process.env.CRON_SECRET;
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run(req, res) {
  if (!secretMatches(req.get('x-cron-secret') || req.query.key)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(await runAllReminders());
}

router.get('/run', asyncHandler(run));
router.post('/run', asyncHandler(run));

module.exports = router;

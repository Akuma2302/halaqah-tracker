const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const pushController = require('../controllers/pushController');
const { subscribeSchema, unsubscribeSchema } = require('../validators/pushValidators');

// Public — the frontend needs this before the user is necessarily logged in
// to know whether push is even configured on this deployment.
router.get('/vapid-public-key', asyncHandler(pushController.vapidPublicKey));

router.use(requireAuth);
router.post('/subscribe', validate(subscribeSchema), asyncHandler(pushController.subscribe));
router.post('/unsubscribe', validate(unsubscribeSchema), asyncHandler(pushController.unsubscribe));

module.exports = router;
const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const asyncHandler = require('../middlewares/asyncHandler');
const notificationController = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', asyncHandler(notificationController.list));
router.patch('/:id/read', asyncHandler(notificationController.markRead));

module.exports = router;

const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const notificationController = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', notificationController.list);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;

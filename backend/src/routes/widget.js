const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const asyncHandler = require('../middlewares/asyncHandler');
const widgetController = require('../controllers/widgetController');

// '/token' is declared before '/:token' so the literal path always wins.
router.get('/token', requireAuth, asyncHandler(widgetController.getToken));
router.post('/token', requireAuth, asyncHandler(widgetController.rotateToken));
router.delete('/token', requireAuth, asyncHandler(widgetController.disable));
router.get('/:token', asyncHandler(widgetController.data));

module.exports = router;

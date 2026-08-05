const router = require('express').Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const { googleLoginSchema, updateProfileSchema } = require('../validators/authValidators');

router.post('/google', validate(googleLoginSchema), asyncHandler(authController.googleLogin));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.put('/me', requireAuth, validate(updateProfileSchema), asyncHandler(authController.updateMe));
router.post('/logout', asyncHandler(authController.logout));

module.exports = router;

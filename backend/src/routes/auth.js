const router = require('express').Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const { googleLoginSchema, updateProfileSchema } = require('../validators/authValidators');

router.post('/google', validate(googleLoginSchema), authController.googleLogin);
router.get('/me', requireAuth, authController.me);
router.put('/me', requireAuth, validate(updateProfileSchema), authController.updateMe);
router.post('/logout', authController.logout);

module.exports = router;

const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const mutabaahController = require('../controllers/mutabaahController');
const { updateEntrySchema } = require('../validators/mutabaahValidators');

router.use(requireAuth);

// Declared before '/:date' so the literal path always wins the match
router.get('/summary', mutabaahController.summary);
router.get('/:date', mutabaahController.getForDate);
router.put('/:date', validate(updateEntrySchema), mutabaahController.updateForDate);

module.exports = router;

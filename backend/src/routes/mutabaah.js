const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const mutabaahController = require('../controllers/mutabaahController');
const { updateEntrySchema } = require('../validators/mutabaahValidators');

router.use(requireAuth);

// Declared before '/:date' so the literal path always wins the match
router.get('/summary', asyncHandler(mutabaahController.summary));
router.get('/:date', asyncHandler(mutabaahController.getForDate));
router.put('/:date', validate(updateEntrySchema), asyncHandler(mutabaahController.updateForDate));

module.exports = router;

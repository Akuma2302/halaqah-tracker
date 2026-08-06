const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const groupController = require('../controllers/groupController');
const { createGroupSchema, joinGroupSchema } = require('../validators/groupValidators');
const { upload } = require('../utils/upload');

router.use(requireAuth);

router.post('/', validate(createGroupSchema), asyncHandler(groupController.create));
router.get('/', asyncHandler(groupController.list));
router.post('/join', validate(joinGroupSchema), asyncHandler(groupController.join));
router.get('/:id/today', asyncHandler(groupController.today));
router.get('/:id/messages', asyncHandler(groupController.messages));
router.post('/:id/upload', upload.single('file'), asyncHandler(groupController.upload));

module.exports = router;

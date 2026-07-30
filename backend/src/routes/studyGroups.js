const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const studyGroupController = require('../controllers/studyGroupController');
const { upload } = require('../utils/upload');
const {
  createStudyGroupSchema,
  joinStudyGroupSchema,
  scheduleSessionSchema
} = require('../validators/studyGroupValidators');

router.use(requireAuth);

router.post('/', validate(createStudyGroupSchema), studyGroupController.create);
router.get('/', studyGroupController.list);
router.get('/:id', studyGroupController.detail);
router.post('/join', validate(joinStudyGroupSchema), studyGroupController.join);
router.post('/:id/schedule', validate(scheduleSessionSchema), studyGroupController.schedule);
router.get('/:id/messages', studyGroupController.messages);
router.post('/:id/upload', upload.single('file'), studyGroupController.upload);

module.exports = router;

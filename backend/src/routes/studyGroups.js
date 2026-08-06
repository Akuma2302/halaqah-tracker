const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const studyGroupController = require('../controllers/studyGroupController');
const { upload } = require('../utils/upload');
const {
  createStudyGroupSchema,
  joinStudyGroupSchema,
  scheduleSessionSchema
} = require('../validators/studyGroupValidators');

router.use(requireAuth);

router.post('/', validate(createStudyGroupSchema), asyncHandler(studyGroupController.create));
router.get('/', asyncHandler(studyGroupController.list));
router.get('/:id', asyncHandler(studyGroupController.detail));
router.post('/join', validate(joinStudyGroupSchema), asyncHandler(studyGroupController.join));
router.post('/:id/schedule', validate(scheduleSessionSchema), asyncHandler(studyGroupController.schedule));
router.get('/:id/messages', asyncHandler(studyGroupController.messages));
router.post('/:id/upload', upload.single('file'), asyncHandler(studyGroupController.upload));
router.get('/:id/scoreboard', asyncHandler(studyGroupController.scoreboard));
router.get('/:id/schedule/:scheduleId/ics', asyncHandler(studyGroupController.scheduleIcs));

module.exports = router;
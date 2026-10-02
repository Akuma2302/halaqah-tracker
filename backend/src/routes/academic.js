const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const { upload } = require('../utils/upload');

const subjectController = require('../controllers/subjectController');
const subjectFileController = require('../controllers/subjectFileController');
const assignmentController = require('../controllers/assignmentController');
const weeklyLogController = require('../controllers/weeklyLogController');
const academicController = require('../controllers/academicController');

const {
  createSubjectSchema,
  updateSubjectSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createStudySessionSchema,
  createQuestionPracticeSchema,
  createConsultationSchema,
  setMentorValidationSchema,
  subjectFolderSchema,
  moveSubjectFileSchema
} = require('../validators/academicValidators');

router.use(requireAuth);

// Dashboard ring + Academic Journal overview
router.get('/summary', asyncHandler(academicController.weeklySummary));
router.get('/overview', asyncHandler(academicController.overview));

// Subjects
router.get('/subjects', asyncHandler(subjectController.list));
router.post('/subjects', validate(createSubjectSchema), asyncHandler(subjectController.create));
router.put('/subjects/:id', validate(updateSubjectSchema), asyncHandler(subjectController.update));
router.delete('/subjects/:id', asyncHandler(subjectController.remove));

// Per-subject files ("folder" of files for that subject)
router.get('/subjects/:id/files', asyncHandler(subjectFileController.list));
router.post('/subjects/:id/files', upload.single('file'), asyncHandler(subjectFileController.upload));
router.patch('/subjects/:id/files/:fileId', validate(moveSubjectFileSchema), asyncHandler(subjectFileController.move));
router.delete('/subjects/:id/files/:fileId', asyncHandler(subjectFileController.remove));
router.get('/subjects/:id/folders', asyncHandler(subjectFileController.listFolders));
router.post('/subjects/:id/folders', validate(subjectFolderSchema), asyncHandler(subjectFileController.createFolder));
router.put('/subjects/:id/folders/:folderId', validate(subjectFolderSchema), asyncHandler(subjectFileController.renameFolder));
router.delete('/subjects/:id/folders/:folderId', asyncHandler(subjectFileController.removeFolder));

// Assignments / projects overview
router.get('/assignments', asyncHandler(assignmentController.list));
router.post('/assignments', validate(createAssignmentSchema), asyncHandler(assignmentController.create));
router.put('/assignments/:id', validate(updateAssignmentSchema), asyncHandler(assignmentController.update));
router.delete('/assignments/:id', asyncHandler(assignmentController.remove));

// Weekly log (study hours, question practice, consultations, mentor validation)
router.get('/weeks/:weekStart', asyncHandler(weeklyLogController.getWeek));
router.get('/weeks/:weekStart/report', asyncHandler(academicController.downloadReport));
router.put(
  '/weeks/:weekStart/mentor-validation',
  validate(setMentorValidationSchema),
  asyncHandler(weeklyLogController.setMentorValidation)
);

router.post('/weeks/study-sessions', validate(createStudySessionSchema), asyncHandler(weeklyLogController.addStudySession));
router.delete('/weeks/study-sessions/:id', asyncHandler(weeklyLogController.removeStudySession));

router.post(
  '/weeks/question-practice',
  validate(createQuestionPracticeSchema),
  asyncHandler(weeklyLogController.addQuestionPractice)
);
router.delete('/weeks/question-practice/:id', asyncHandler(weeklyLogController.removeQuestionPractice));

router.post('/weeks/consultations', validate(createConsultationSchema), asyncHandler(weeklyLogController.addConsultation));
router.delete('/weeks/consultations/:id', asyncHandler(weeklyLogController.removeConsultation));

router.post('/weeks/upload', upload.single('file'), asyncHandler(weeklyLogController.uploadPhoto));

module.exports = router;

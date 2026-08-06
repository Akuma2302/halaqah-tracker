const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const folderController = require('../controllers/folderController');
const { createFolderSchema, addGroupSchema } = require('../validators/folderValidators');

router.use(requireAuth);

router.get('/', asyncHandler(folderController.list));
router.post('/', validate(createFolderSchema), asyncHandler(folderController.create));
router.put('/:id', validate(createFolderSchema), asyncHandler(folderController.rename));
router.delete('/:id', asyncHandler(folderController.remove));

router.post('/:id/groups', validate(addGroupSchema), asyncHandler(folderController.addGroup));
router.delete('/:id/groups/:studyGroupId', asyncHandler(folderController.removeGroup));

module.exports = router;
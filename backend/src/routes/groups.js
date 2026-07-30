const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const groupController = require('../controllers/groupController');
const { createGroupSchema, joinGroupSchema } = require('../validators/groupValidators');

router.use(requireAuth);

router.post('/', validate(createGroupSchema), groupController.create);
router.get('/', groupController.list);
router.post('/join', validate(joinGroupSchema), groupController.join);
router.get('/:id/today', groupController.today);

module.exports = router;

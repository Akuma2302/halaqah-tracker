const router = require('express').Router();
const asyncHandler = require('../middlewares/asyncHandler');
const contentController = require('../controllers/contentController');

// Public reference content — no login required to read it
router.get('/', asyncHandler(contentController.list));

module.exports = router;

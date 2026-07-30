const router = require('express').Router();
const contentController = require('../controllers/contentController');

// Public reference content — no login required to read it
router.get('/', contentController.list);

module.exports = router;

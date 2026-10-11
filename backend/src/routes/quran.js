const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const validate = require('../middlewares/validate');
const asyncHandler = require('../middlewares/asyncHandler');
const quranController = require('../controllers/quranController');
const { saveBookmarkSchema, saveTadabburSchema } = require('../validators/quranValidators');

router.use(requireAuth);

// Quran bookmarks, synced across the user's devices. The id goes in the
// query string for DELETE because it contains ":" or "/".
router.get('/bookmarks', asyncHandler(quranController.listBookmarks));
router.post('/bookmarks', validate(saveBookmarkSchema), asyncHandler(quranController.saveBookmark));
router.delete('/bookmarks', asyncHandler(quranController.removeBookmark));

// Ayat saved for tadabbur, each with the user's note. The ayat key goes in the
// query string for DELETE because it contains ":".
router.get('/tadabbur', asyncHandler(quranController.listTadabbur));
router.post('/tadabbur', validate(saveTadabburSchema), asyncHandler(quranController.saveTadabbur));
router.delete('/tadabbur', asyncHandler(quranController.removeTadabbur));

module.exports = router;

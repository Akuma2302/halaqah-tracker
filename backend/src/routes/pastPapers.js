const router = require('express').Router();
const requireAuth = require('../middlewares/requireAuth');
const asyncHandler = require('../middlewares/asyncHandler');
const pastPaperRepository = require('../repositories/pastPaperRepository');
const { upload, uploadBufferToSupabase } = require('../utils/upload');

// Past year papers shared by users with every other user of the app: search
// and filter them, add one (a file plus where it is from), remove your own.

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const PAPER_TYPES = ['Final exam', 'Mid-term', 'Test', 'Quiz', 'Tutorial', 'Other'];

const text = (value, max) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await pastPaperRepository.search({
      q: req.query.q,
      university: req.query.university,
      course: req.query.course,
      // ?mine=1 lists only the papers the signed-in user shared
      uploaderId: req.query.mine ? req.userId : undefined
    });
    res.json(rows.map(pastPaperRepository.serialize));
  })
);

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const university = text(req.body.university, 160);
    const course = text(req.body.course, 120);
    const subject = text(req.body.subject, 120);
    const subjectCode = text(req.body.subjectCode, 30);
    const paperType = PAPER_TYPES.includes(req.body.paperType) ? req.body.paperType : '';
    const year = /^\d{4}$/.test(String(req.body.year || '')) ? Number(req.body.year) : null;

    if (!req.file) return res.status(400).json({ error: 'Choose the file to upload' });
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) return res.status(400).json({ error: 'Upload a PDF, a Word document or a photo' });
    if (!university || !course || !subject) return res.status(400).json({ error: 'Fill in the university, the course and the subject' });
    if (year !== null && (year < 1990 || year > new Date().getFullYear() + 1)) return res.status(400).json({ error: 'That year does not look right' });

    const stored = await uploadBufferToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'past-papers');
    const row = await pastPaperRepository.create({
      uploader_id: req.userId,
      university,
      course,
      subject,
      subject_code: subjectCode,
      year,
      paper_type: paperType,
      file_url: stored.url,
      file_name: text(req.file.originalname, 200),
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });
    res.status(201).json(pastPaperRepository.serialize(row));
  })
);

// Only whoever shared a paper can take it down.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await pastPaperRepository.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Paper not found' });
    if (row.uploader_id !== req.userId) return res.status(403).json({ error: 'Only the person who shared it can remove it' });
    await pastPaperRepository.remove(req.params.id, req.userId);
    res.json({ ok: true });
  })
);

module.exports = router;

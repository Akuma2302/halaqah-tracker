const subjectFileService = require('../services/subjectFileService');
const { uploadBufferToSupabase } = require('../utils/upload');

async function list(req, res) {
  try {
    const files = await subjectFileService.listFiles(req.params.id, req.userId);
    res.json(files);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await uploadBufferToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype, 'subjects');
    const file = await subjectFileService.addFile(req.params.id, req.userId, {
      fileName: req.file.originalname,
      fileUrl: result.url,
      fileSize: req.file.size
    });
    res.status(201).json(file);
  } catch (err) {
    console.error('Subject file upload error:', err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Upload failed' });
  }
}

async function remove(req, res) {
  await subjectFileService.removeFile(req.params.fileId, req.userId);
  res.json({ ok: true });
}

module.exports = { list, upload, remove };

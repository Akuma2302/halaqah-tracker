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
      folderId: req.body?.folderId || null,
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

async function move(req, res) {
  const file = await subjectFileService.moveFile(req.params.id, req.params.fileId, req.userId, req.body.folderId);
  res.json(file);
}

async function remove(req, res) {
  await subjectFileService.removeFile(req.params.fileId, req.userId);
  res.json({ ok: true });
}

async function listFolders(req, res) {
  res.json(await subjectFileService.listFolders(req.params.id, req.userId));
}

async function createFolder(req, res) {
  res.status(201).json(await subjectFileService.createFolder(req.params.id, req.userId, req.body.name));
}

async function renameFolder(req, res) {
  res.json(await subjectFileService.renameFolder(req.params.id, req.params.folderId, req.userId, req.body.name));
}

async function removeFolder(req, res) {
  await subjectFileService.removeFolder(req.params.id, req.params.folderId, req.userId);
  res.json({ ok: true });
}

module.exports = { list, upload, move, remove, listFolders, createFolder, renameFolder, removeFolder };

const weeklyLogService = require('../services/weeklyLogService');
const { uploadBufferToSupabase } = require('../utils/upload');

async function getWeek(req, res) {
  const weekStart = req.params.weekStart;
  const data = await weeklyLogService.getWeek(req.userId, weekStart);
  res.json(data);
}

async function addStudySession(req, res) {
  const row = await weeklyLogService.addStudySession(req.userId, req.body);
  res.status(201).json(row);
}

async function removeStudySession(req, res) {
  await weeklyLogService.removeStudySession(req.params.id, req.userId);
  res.json({ ok: true });
}

async function addQuestionPractice(req, res) {
  const row = await weeklyLogService.addQuestionPractice(req.userId, req.body);
  res.status(201).json(row);
}

async function removeQuestionPractice(req, res) {
  await weeklyLogService.removeQuestionPractice(req.params.id, req.userId);
  res.json({ ok: true });
}

async function addConsultation(req, res) {
  const row = await weeklyLogService.addConsultation(req.userId, req.body);
  res.status(201).json(row);
}

async function removeConsultation(req, res) {
  await weeklyLogService.removeConsultation(req.params.id, req.userId);
  res.json({ ok: true });
}

async function setMentorValidation(req, res) {
  const row = await weeklyLogService.setMentorValidation(req.userId, req.params.weekStart, req.body);
  res.json(row);
}

async function uploadPhoto(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await uploadBufferToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url: result.url });
  } catch (err) {
    console.error('Supabase Storage upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = {
  getWeek,
  addStudySession,
  removeStudySession,
  addQuestionPractice,
  removeQuestionPractice,
  addConsultation,
  removeConsultation,
  setMentorValidation,
  uploadPhoto
};

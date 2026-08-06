const studyGroupService = require('../services/studyGroupService');
const { uploadBufferToSupabase } = require('../utils/upload');

async function create(req, res) {
  const group = await studyGroupService.createStudyGroup(req.body.name.trim(), (req.body.subject || '').trim(), req.userId);
  res.status(201).json(group);
}

async function list(req, res) {
  const groups = await studyGroupService.listStudyGroupsForUser(req.userId);
  res.json(groups);
}

async function detail(req, res) {
  try {
    const group = await studyGroupService.getStudyGroupDetail(req.params.id, req.userId);
    res.json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function join(req, res) {
  try {
    const group = await studyGroupService.joinStudyGroup(req.body.inviteCode, req.userId);
    res.json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function schedule(req, res) {
  try {
    const group = await studyGroupService.scheduleSession(req.params.id, req.userId, req.body);
    res.json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function messages(req, res) {
  const list = await studyGroupService.listMessages(req.params.id);
  res.json(list);
}

async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await uploadBufferToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url: result.url, type: req.file.mimetype?.startsWith('image/') ? 'image' : 'file' });
  } catch (err) {
    console.error('Supabase Storage upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
}

async function scoreboard(req, res) {
  try {
    const data = await studyGroupService.getScoreboard(req.params.id, req.userId);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function scheduleIcs(req, res) {
  try {
    const ics = await studyGroupService.getScheduleIcs(req.params.id, req.params.scheduleId, req.userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="session-${req.params.scheduleId}.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { create, list, detail, join, schedule, messages, upload, scoreboard, scheduleIcs };
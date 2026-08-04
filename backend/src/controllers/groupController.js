const groupService = require('../services/groupService');
const { uploadBufferToSupabase } = require('../utils/upload');

async function create(req, res) {
  const group = await groupService.createGroup(req.body.name.trim(), req.session.userId);
  res.status(201).json(group);
}

async function list(req, res) {
  const groups = await groupService.listGroupsForUser(req.session.userId);
  res.json(groups);
}

async function join(req, res) {
  try {
    const group = await groupService.joinGroup(req.body.inviteCode, req.session.userId);
    res.json(group);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function today(req, res) {
  try {
    const data = await groupService.getTodayStatus(req.params.id, req.session.userId);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function messages(req, res) {
  const list = await groupService.listMessages(req.params.id);
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

module.exports = { create, list, join, today, messages, upload };

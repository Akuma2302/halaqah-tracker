const subjectService = require('../services/subjectService');

async function list(req, res) {
  const subjects = await subjectService.listAll(req.userId);
  res.json(subjects);
}

async function create(req, res) {
  const subject = await subjectService.create(req.userId, req.body);
  res.status(201).json(subject);
}

async function update(req, res) {
  try {
    const subject = await subjectService.update(req.params.id, req.userId, req.body);
    res.json(subject);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function remove(req, res) {
  await subjectService.remove(req.params.id, req.userId);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };

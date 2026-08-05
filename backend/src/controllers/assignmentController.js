const assignmentService = require('../services/assignmentService');

async function list(req, res) {
  const assignments = await assignmentService.listAll(req.userId);
  res.json(assignments);
}

async function create(req, res) {
  const assignment = await assignmentService.create(req.userId, req.body);
  res.status(201).json(assignment);
}

async function update(req, res) {
  try {
    const assignment = await assignmentService.update(req.params.id, req.userId, req.body);
    res.json(assignment);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function remove(req, res) {
  await assignmentService.remove(req.params.id, req.userId);
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };

const groupService = require('../services/groupService');

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

module.exports = { create, list, join, today };

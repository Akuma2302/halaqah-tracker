const folderService = require('../services/folderService');

async function list(req, res) {
  const folders = await folderService.listFolders(req.userId);
  res.json(folders);
}

async function create(req, res) {
  const folder = await folderService.createFolder(req.userId, req.body.name);
  res.status(201).json(folder);
}

async function rename(req, res) {
  try {
    const folder = await folderService.renameFolder(req.params.id, req.userId, req.body.name);
    res.json(folder);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function remove(req, res) {
  await folderService.deleteFolder(req.params.id, req.userId);
  res.json({ ok: true });
}

async function addGroup(req, res) {
  try {
    await folderService.addGroupToFolder(req.params.id, req.userId, req.body.studyGroupId);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function removeGroup(req, res) {
  try {
    await folderService.removeGroupFromFolder(req.params.id, req.userId, req.params.studyGroupId);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, create, rename, remove, addGroup, removeGroup };
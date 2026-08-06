const folderRepository = require('../repositories/folderRepository');
const studyGroupRepository = require('../repositories/studyGroupRepository');
const { serializeFolder } = require('../utils/serializers');

async function listFolders(userId) {
  const [folders, items] = await Promise.all([folderRepository.findAllForUser(userId), folderRepository.findItemsForUser(userId)]);

  const groupIdsByFolder = {};
  items.forEach(({ folderId, studyGroupId }) => {
    (groupIdsByFolder[folderId] ||= []).push(studyGroupId);
  });

  return folders.map((f) => ({ ...serializeFolder(f), groupIds: groupIdsByFolder[f.id] || [] }));
}

async function createFolder(userId, name) {
  const row = await folderRepository.create(userId, name.trim());
  return { ...serializeFolder(row), groupIds: [] };
}

async function renameFolder(id, userId, name) {
  const row = await folderRepository.rename(id, userId, name.trim());
  if (!row) {
    const err = new Error('Folder not found');
    err.status = 404;
    throw err;
  }
  return serializeFolder(row);
}

async function deleteFolder(id, userId) {
  await folderRepository.remove(id, userId);
}

async function addGroupToFolder(folderId, userId, studyGroupId) {
  const folder = await folderRepository.findById(folderId, userId);
  if (!folder) {
    const err = new Error('Folder not found');
    err.status = 404;
    throw err;
  }
  const member = await studyGroupRepository.findMember(studyGroupId, userId);
  if (!member) {
    const err = new Error('Not a member of this group');
    err.status = 403;
    throw err;
  }
  await folderRepository.addGroup(folderId, studyGroupId);
}

async function removeGroupFromFolder(folderId, userId, studyGroupId) {
  const folder = await folderRepository.findById(folderId, userId);
  if (!folder) {
    const err = new Error('Folder not found');
    err.status = 404;
    throw err;
  }
  await folderRepository.removeGroup(folderId, studyGroupId);
}

module.exports = { listFolders, createFolder, renameFolder, deleteFolder, addGroupToFolder, removeGroupFromFolder };
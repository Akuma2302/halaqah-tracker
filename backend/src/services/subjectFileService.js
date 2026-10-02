const subjectRepository = require('../repositories/subjectRepository');
const subjectFileRepository = require('../repositories/subjectFileRepository');
const { serializeSubjectFile, serializeSubjectFolder } = require('../utils/serializers');

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

async function assertOwnsSubject(subjectId, userId) {
  const subject = await subjectRepository.findById(subjectId, userId);
  if (!subject) throw notFound('Subject not found');
}

// A folder id from the client must belong to this subject and user; null means top level.
async function checkFolder(folderId, subjectId, userId) {
  if (!folderId) return null;
  const folder = await subjectFileRepository.findFolder(folderId, subjectId, userId);
  if (!folder) throw notFound('Folder not found');
  return folder.id;
}

async function listFiles(subjectId, userId) {
  await assertOwnsSubject(subjectId, userId);
  const rows = await subjectFileRepository.findBySubject(subjectId, userId);
  return rows.map(serializeSubjectFile);
}

async function addFile(subjectId, userId, { folderId, fileName, fileUrl, fileSize }) {
  await assertOwnsSubject(subjectId, userId);
  const checkedFolderId = await checkFolder(folderId, subjectId, userId);
  const row = await subjectFileRepository.create(userId, { subjectId, folderId: checkedFolderId, fileName, fileUrl, fileSize });
  return serializeSubjectFile(row);
}

async function moveFile(subjectId, fileId, userId, folderId) {
  await assertOwnsSubject(subjectId, userId);
  const checkedFolderId = await checkFolder(folderId, subjectId, userId);
  const row = await subjectFileRepository.setFolder(fileId, subjectId, userId, checkedFolderId);
  if (!row) throw notFound('File not found');
  return serializeSubjectFile(row);
}

async function removeFile(fileId, userId) {
  await subjectFileRepository.remove(fileId, userId);
}

async function listFolders(subjectId, userId) {
  await assertOwnsSubject(subjectId, userId);
  const rows = await subjectFileRepository.findFolders(subjectId, userId);
  return rows.map(serializeSubjectFolder);
}

async function createFolder(subjectId, userId, name) {
  await assertOwnsSubject(subjectId, userId);
  const row = await subjectFileRepository.createFolder(userId, subjectId, name);
  return serializeSubjectFolder(row);
}

async function renameFolder(subjectId, folderId, userId, name) {
  await checkFolder(folderId, subjectId, userId);
  const row = await subjectFileRepository.renameFolder(folderId, userId, name);
  return serializeSubjectFolder(row);
}

// The folder's files go back to the top level (folder_id is set null by the FK).
async function removeFolder(subjectId, folderId, userId) {
  await checkFolder(folderId, subjectId, userId);
  await subjectFileRepository.removeFolder(folderId, userId);
}

module.exports = { listFiles, addFile, moveFile, removeFile, listFolders, createFolder, renameFolder, removeFolder };

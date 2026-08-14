const subjectRepository = require('../repositories/subjectRepository');
const subjectFileRepository = require('../repositories/subjectFileRepository');
const { serializeSubjectFile } = require('../utils/serializers');

async function assertOwnsSubject(subjectId, userId) {
  const subject = await subjectRepository.findById(subjectId, userId);
  if (!subject) {
    const err = new Error('Subject not found');
    err.status = 404;
    throw err;
  }
}

async function listFiles(subjectId, userId) {
  await assertOwnsSubject(subjectId, userId);
  const rows = await subjectFileRepository.findBySubject(subjectId, userId);
  return rows.map(serializeSubjectFile);
}

async function addFile(subjectId, userId, { fileName, fileUrl, fileSize }) {
  await assertOwnsSubject(subjectId, userId);
  const row = await subjectFileRepository.create(userId, { subjectId, fileName, fileUrl, fileSize });
  return serializeSubjectFile(row);
}

async function removeFile(fileId, userId) {
  await subjectFileRepository.remove(fileId, userId);
}

module.exports = { listFiles, addFile, removeFile };

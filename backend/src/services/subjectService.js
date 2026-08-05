const subjectRepository = require('../repositories/subjectRepository');
const { serializeSubject } = require('../utils/serializers');

async function listAll(userId) {
  const rows = await subjectRepository.findAllForUser(userId);
  return rows.map(serializeSubject);
}

async function listVisible(userId) {
  const rows = await subjectRepository.findVisibleForUser(userId);
  return rows.map(serializeSubject);
}

async function create(userId, input) {
  const row = await subjectRepository.create(userId, input);
  return serializeSubject(row);
}

async function update(id, userId, input) {
  const row = await subjectRepository.update(id, userId, input);
  if (!row) {
    const err = new Error('Subject not found');
    err.status = 404;
    throw err;
  }
  return serializeSubject(row);
}

async function remove(id, userId) {
  await subjectRepository.remove(id, userId);
}

module.exports = { listAll, listVisible, create, update, remove };

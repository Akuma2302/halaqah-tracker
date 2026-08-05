const assignmentRepository = require('../repositories/assignmentRepository');
const { serializeAssignment } = require('../utils/serializers');

async function listAll(userId) {
  const rows = await assignmentRepository.findAllForUser(userId);
  return rows.map(serializeAssignment);
}

async function listUpcoming(userId, limit) {
  const rows = await assignmentRepository.findUpcomingForUser(userId, limit);
  return rows.map(serializeAssignment);
}

async function create(userId, input) {
  const row = await assignmentRepository.create(userId, input);
  return serializeAssignment(row);
}

async function update(id, userId, input) {
  const row = await assignmentRepository.update(id, userId, input);
  if (!row) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  return serializeAssignment(row);
}

async function remove(id, userId) {
  await assignmentRepository.remove(id, userId);
}

module.exports = { listAll, listUpcoming, create, update, remove };

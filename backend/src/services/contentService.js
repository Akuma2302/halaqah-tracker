const contentRepository = require('../repositories/contentRepository');
const { serializeContentItem } = require('../utils/serializers');

async function listAll() {
  const rows = await contentRepository.findAll();
  return rows.map(serializeContentItem);
}

module.exports = { listAll };

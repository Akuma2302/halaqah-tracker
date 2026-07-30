const contentService = require('../services/contentService');

async function list(req, res) {
  const items = await contentService.listAll();
  res.json(items);
}

module.exports = { list };

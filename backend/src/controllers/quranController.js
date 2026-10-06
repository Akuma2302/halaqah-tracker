const quranBookmarkRepository = require('../repositories/quranBookmarkRepository');

// Same shape the frontend keeps on the device (features/quran/bookmarks.js).
function serialize(row) {
  return {
    id: row.mark_id,
    kind: row.kind,
    number: row.number,
    key: row.verse_key,
    label: row.label,
    at: new Date(row.created_at).getTime()
  };
}

async function listBookmarks(req, res) {
  const rows = await quranBookmarkRepository.findByUser(req.userId);
  res.json(rows.map(serialize));
}

async function saveBookmark(req, res) {
  const { id, kind, number, key, label, at } = req.body;
  const row = await quranBookmarkRepository.upsert(req.userId, {
    markId: id,
    kind,
    number,
    verseKey: key || null,
    label,
    createdAt: new Date(at || Date.now()).toISOString()
  });
  res.status(201).json(serialize(row));
}

async function removeBookmark(req, res) {
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Bookmark id is required' });
  await quranBookmarkRepository.remove(req.userId, id);
  res.json({ ok: true });
}

module.exports = { listBookmarks, saveBookmark, removeBookmark };

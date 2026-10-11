const quranBookmarkRepository = require('../repositories/quranBookmarkRepository');
const quranTadabburRepository = require('../repositories/quranTadabburRepository');

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

async function listTadabbur(req, res) {
  const rows = await quranTadabburRepository.findByUser(req.userId);
  res.json(rows.map(quranTadabburRepository.serialize));
}

async function saveTadabbur(req, res) {
  const { key, label, arabic, translation, note } = req.body;
  const row = await quranTadabburRepository.upsert(req.userId, { verseKey: key, label, arabic, translation, note });
  res.status(201).json(quranTadabburRepository.serialize(row));
}

async function removeTadabbur(req, res) {
  const key = String(req.query.key || '');
  if (!key) return res.status(400).json({ error: 'Ayat is required' });
  await quranTadabburRepository.remove(req.userId, key);
  res.json({ ok: true });
}

module.exports = { listBookmarks, saveBookmark, removeBookmark, listTadabbur, saveTadabbur, removeTadabbur };

const supabase = require('../config/supabaseClient');

async function findByUser(userId) {
  const { data, error } = await supabase
    .from('quran_tadabbur')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

// One entry per (user, ayat): saving it again replaces its note.
async function upsert(userId, { verseKey, label, arabic, translation, note }) {
  const { data, error } = await supabase
    .from('quran_tadabbur')
    .upsert(
      { user_id: userId, verse_key: verseKey, label, arabic, translation, note, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,verse_key' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function remove(userId, verseKey) {
  const { error } = await supabase.from('quran_tadabbur').delete().eq('user_id', userId).eq('verse_key', verseKey);
  if (error) throw error;
}

function serialize(row) {
  return {
    key: row.verse_key,
    label: row.label,
    arabic: row.arabic,
    translation: row.translation,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { findByUser, upsert, remove, serialize };

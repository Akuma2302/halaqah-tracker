const supabase = require('../config/supabaseClient');

async function findByUser(userId) {
  const { data, error } = await supabase
    .from('quran_bookmarks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// One bookmark per (user, mark): saving it again just refreshes it.
async function upsert(userId, { markId, kind, number, verseKey, label, createdAt }) {
  const { data, error } = await supabase
    .from('quran_bookmarks')
    .upsert(
      { user_id: userId, mark_id: markId, kind, number, verse_key: verseKey, label, created_at: createdAt },
      { onConflict: 'user_id,mark_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function remove(userId, markId) {
  const { error } = await supabase.from('quran_bookmarks').delete().eq('user_id', userId).eq('mark_id', markId);
  if (error) throw error;
}

module.exports = { findByUser, upsert, remove };

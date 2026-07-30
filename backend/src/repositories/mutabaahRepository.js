const supabase = require('../config/supabaseClient');

async function findByUserAndDate(userId, date) {
  const { data, error } = await supabase
    .from('mutabaah_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByUsersAndDate(userIds, date) {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from('mutabaah_entries')
    .select('*')
    .in('user_id', userIds)
    .eq('date', date);
  if (error) throw error;
  return data;
}

async function findRangeForUser(userId, sinceDate) {
  const { data, error } = await supabase
    .from('mutabaah_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

// Upsert on (user_id, date) — mirrors the old findOneAndUpdate(..., { upsert: true })
async function upsert(userId, date, fields) {
  const { data, error } = await supabase
    .from('mutabaah_entries')
    .upsert(
      { user_id: userId, date, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { findByUserAndDate, findByUsersAndDate, findRangeForUser, upsert };

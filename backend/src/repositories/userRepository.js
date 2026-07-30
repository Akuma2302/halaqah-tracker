const supabase = require('../config/supabaseClient');

async function findByGoogleId(googleId) {
  const { data, error } = await supabase.from('users').select('*').eq('google_id', googleId).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function create({ googleId, email, name, avatarUrl }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ google_id: googleId, email, name, avatar_url: avatarUrl || '' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(id, fields) {
  const { data, error } = await supabase
    .from('users')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function findByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('users').select('*').in('id', ids);
  if (error) throw error;
  return data;
}

module.exports = { findByGoogleId, findById, create, update, findByIds };

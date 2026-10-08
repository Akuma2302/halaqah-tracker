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

async function findByWidgetToken(token) {
  const { data, error } = await supabase.from('users').select('*').eq('widget_token', token).maybeSingle();
  if (error) throw error;
  return data;
}

async function findWithMutabaahRemindersOn() {
  const { data, error } = await supabase.from('users').select('id, name').eq('mutabaah_reminders', true);
  if (error) throw error;
  return data;
}

// By the running number behind the short User ID ("D4F-0007" -> 7).
async function findByMemberNo(memberNo) {
  const { data, error } = await supabase.from('users').select('*').eq('member_no', memberNo).maybeSingle();
  if (error) throw error;
  return data;
}

// Everyone who has set this user as their mentor.
async function findMentees(mentorId) {
  const { data, error } = await supabase.from('users').select('*').eq('mentor_id', mentorId);
  if (error) throw error;
  return data;
}

module.exports = {
  findByMemberNo,
  findMentees,
  findByGoogleId,
  findById,
  create,
  update,
  findByIds,
  findByWidgetToken,
  findWithMutabaahRemindersOn
};

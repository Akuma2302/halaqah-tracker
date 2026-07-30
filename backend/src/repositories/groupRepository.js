const supabase = require('../config/supabaseClient');

async function inviteCodeExists(inviteCode) {
  const { data, error } = await supabase.from('groups').select('id').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function create({ name, ownerId, inviteCode }) {
  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, owner_id: ownerId, invite_code: inviteCode })
    .select()
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase.from('group_members').insert({ group_id: group.id, user_id: ownerId });
  if (memberError) throw memberError;

  return group;
}

async function findByInviteCode(inviteCode) {
  const { data, error } = await supabase.from('groups').select('*').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// All groups a user belongs to, most recently created first.
async function findAllForUser(userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row) => row.group).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function listMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, joined_at')
    .eq('group_id', groupId);
  if (error) throw error;
  return data;
}

async function isMember(groupId, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function addMember(groupId, userId) {
  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== '23505') throw error; // ignore "already a member"
}

module.exports = {
  inviteCodeExists,
  create,
  findByInviteCode,
  findById,
  findAllForUser,
  listMembers,
  isMember,
  addMember
};

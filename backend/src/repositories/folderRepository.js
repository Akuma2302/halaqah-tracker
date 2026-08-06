const supabase = require('../config/supabaseClient');

async function findAllForUser(userId) {
  const { data, error } = await supabase
    .from('group_folders')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// All (folder_id, study_group_id) pairs across every folder this user owns —
// lets the frontend show which folders each group already belongs to.
async function findItemsForUser(userId) {
  const { data, error } = await supabase
    .from('group_folder_items')
    .select('folder_id, study_group_id, group_folders!inner(user_id)')
    .eq('group_folders.user_id', userId);
  if (error) throw error;
  return (data || []).map((row) => ({ folderId: row.folder_id, studyGroupId: row.study_group_id }));
}

async function findById(id, userId) {
  const { data, error } = await supabase.from('group_folders').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function create(userId, name) {
  const { data, error } = await supabase.from('group_folders').insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
}

async function rename(id, userId, name) {
  const { data, error } = await supabase
    .from('group_folders')
    .update({ name })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('group_folders').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

async function addGroup(folderId, studyGroupId) {
  const { error } = await supabase.from('group_folder_items').insert({ folder_id: folderId, study_group_id: studyGroupId });
  if (error && error.code !== '23505') throw error; // ignore "already in folder"
}

async function removeGroup(folderId, studyGroupId) {
  const { error } = await supabase
    .from('group_folder_items')
    .delete()
    .eq('folder_id', folderId)
    .eq('study_group_id', studyGroupId);
  if (error) throw error;
}

module.exports = { findAllForUser, findItemsForUser, findById, create, rename, remove, addGroup, removeGroup };
const supabase = require('../config/supabaseClient');

async function findBySubject(subjectId, userId) {
  const { data, error } = await supabase
    .from('subject_files')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function create(userId, { subjectId, folderId, fileName, fileUrl, fileSize }) {
  const { data, error } = await supabase
    .from('subject_files')
    .insert({
      subject_id: subjectId,
      user_id: userId,
      folder_id: folderId || null,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize || 0
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function setFolder(id, subjectId, userId, folderId) {
  const { data, error } = await supabase
    .from('subject_files')
    .update({ folder_id: folderId || null })
    .eq('id', id)
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('subject_files').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ---------- folders ----------
async function findFolders(subjectId, userId) {
  const { data, error } = await supabase
    .from('subject_folders')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

async function findFolder(id, subjectId, userId) {
  const { data, error } = await supabase
    .from('subject_folders')
    .select('*')
    .eq('id', id)
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createFolder(userId, subjectId, name) {
  const { data, error } = await supabase
    .from('subject_folders')
    .insert({ subject_id: subjectId, user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function renameFolder(id, userId, name) {
  const { data, error } = await supabase
    .from('subject_folders')
    .update({ name })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function removeFolder(id, userId) {
  const { error } = await supabase.from('subject_folders').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findBySubject, create, setFolder, remove, findFolders, findFolder, createFolder, renameFolder, removeFolder };

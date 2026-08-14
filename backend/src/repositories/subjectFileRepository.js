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

async function create(userId, { subjectId, fileName, fileUrl, fileSize }) {
  const { data, error } = await supabase
    .from('subject_files')
    .insert({ subject_id: subjectId, user_id: userId, file_name: fileName, file_url: fileUrl, file_size: fileSize || 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('subject_files').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findBySubject, create, remove };

const supabase = require('../config/supabaseClient');

// A subject's notes, written in the app. Kept to their owner.

async function findBySubject(subjectId, userId) {
  const { data, error } = await supabase
    .from('subject_notes')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function create(userId, { subjectId, folderId, title, body }) {
  const { data, error } = await supabase
    .from('subject_notes')
    .insert({ subject_id: subjectId, user_id: userId, folder_id: folderId || null, title: title || '', body: body || '' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Only the fields sent are changed.
async function update(id, subjectId, userId, { title, body, pinned, folderId }) {
  const fields = {
    ...(title !== undefined ? { title } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(pinned !== undefined ? { pinned } : {}),
    ...(folderId !== undefined ? { folder_id: folderId || null } : {}),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('subject_notes')
    .update(fields)
    .eq('id', id)
    .eq('subject_id', subjectId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('subject_notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

function serialize(row) {
  return {
    _id: row.id,
    subjectId: row.subject_id,
    folderId: row.folder_id || null,
    title: row.title || '',
    body: row.body || '',
    pinned: !!row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { findBySubject, create, update, remove, serialize };

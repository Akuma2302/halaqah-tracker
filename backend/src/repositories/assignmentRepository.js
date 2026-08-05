const supabase = require('../config/supabaseClient');

async function findAllForUser(userId) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, subject:subjects(id, name, code)')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

async function findUpcomingForUser(userId, limit = 8) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, subject:subjects(id, name, code)')
    .eq('user_id', userId)
    .eq('is_done', false)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function create(userId, { subjectId, title, type, dueDate }) {
  const { data, error } = await supabase
    .from('assignments')
    .insert({ user_id: userId, subject_id: subjectId || null, title, type: type || 'assignment', due_date: dueDate || null })
    .select('*, subject:subjects(id, name, code)')
    .single();
  if (error) throw error;
  return data;
}

async function update(id, userId, fields) {
  const patch = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.type !== undefined) patch.type = fields.type;
  if (fields.dueDate !== undefined) patch.due_date = fields.dueDate;
  if (fields.subjectId !== undefined) patch.subject_id = fields.subjectId;
  if (fields.isDone !== undefined) patch.is_done = fields.isDone;

  const { data, error } = await supabase
    .from('assignments')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, subject:subjects(id, name, code)')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('assignments').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findAllForUser, findUpcomingForUser, create, update, remove };

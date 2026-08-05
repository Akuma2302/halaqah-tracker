const supabase = require('../config/supabaseClient');

function toAssessmentRow(subjectId, a) {
  return {
    subject_id: subjectId,
    type: a.type,
    percentage: a.percentage,
    due_date: a.dueDate || null,
    progress_percentage: a.progressPercentage || 0,
    is_done: !!a.isDone
  };
}

async function findAllForUser(userId) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*, subject_assessments(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function findVisibleForUser(userId) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*, subject_assessments(*)')
    .eq('user_id', userId)
    .eq('is_visible', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function findById(id, userId) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*, subject_assessments(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create(userId, { name, code, lecturerName, creditHour, assessments }) {
  const { data: subject, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name, code: code || '', lecturer_name: lecturerName || '', credit_hour: creditHour || 0 })
    .select()
    .single();
  if (error) throw error;

  if (assessments?.length) {
    const { error: assessError } = await supabase
      .from('subject_assessments')
      .insert(assessments.map((a) => toAssessmentRow(subject.id, a)));
    if (assessError) throw assessError;
  }

  return findById(subject.id, userId);
}

async function update(id, userId, { name, code, lecturerName, creditHour, isVisible, assessments }) {
  const fields = { updated_at: new Date().toISOString() };
  if (name !== undefined) fields.name = name;
  if (code !== undefined) fields.code = code;
  if (lecturerName !== undefined) fields.lecturer_name = lecturerName;
  if (creditHour !== undefined) fields.credit_hour = creditHour;
  if (isVisible !== undefined) fields.is_visible = isVisible;

  const { error } = await supabase.from('subjects').update(fields).eq('id', id).eq('user_id', userId);
  if (error) throw error;

  // Assessments are replaced wholesale on update — simpler and safer than diffing.
  if (assessments) {
    const { error: delError } = await supabase.from('subject_assessments').delete().eq('subject_id', id);
    if (delError) throw delError;
    if (assessments.length) {
      const { error: insError } = await supabase
        .from('subject_assessments')
        .insert(assessments.map((a) => toAssessmentRow(id, a)));
      if (insError) throw insError;
    }
  }

  return findById(id, userId);
}

async function remove(id, userId) {
  const { error } = await supabase.from('subjects').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findAllForUser, findVisibleForUser, findById, create, update, remove };

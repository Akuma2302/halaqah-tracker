const supabase = require('../config/supabaseClient');

async function findForWeek(userId, weekStart) {
  const { data, error } = await supabase
    .from('question_practice')
    .select('*, subject:subjects(id, name, code)')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function create(userId, { subjectId, weekStart, questionCount, isValidated, photoUrls }) {
  const { data, error } = await supabase
    .from('question_practice')
    .insert({
      user_id: userId,
      subject_id: subjectId || null,
      week_start: weekStart,
      question_count: questionCount,
      is_validated: !!isValidated,
      photo_urls: photoUrls || []
    })
    .select('*, subject:subjects(id, name, code)')
    .single();
  if (error) throw error;
  return data;
}

// Changes one of the user's own sets; null if it isn't theirs. It stays in its week.
async function update(id, userId, { subjectId, questionCount, isValidated, photoUrls }) {
  const { data, error } = await supabase
    .from('question_practice')
    .update({ subject_id: subjectId || null, question_count: questionCount, is_validated: !!isValidated, photo_urls: photoUrls || [] })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, subject:subjects(id, name, code)')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('question_practice').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findForWeek, create, update, remove };

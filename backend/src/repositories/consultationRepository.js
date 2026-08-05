const supabase = require('../config/supabaseClient');

async function findForWeek(userId, weekStart) {
  const { data, error } = await supabase
    .from('lecturer_consultations')
    .select('*, subject:subjects(id, name, code, lecturer_name)')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

async function create(userId, { subjectId, weekStart, lecturerName, detail, date, venue, photoUrl }) {
  const { data, error } = await supabase
    .from('lecturer_consultations')
    .insert({
      user_id: userId,
      subject_id: subjectId || null,
      week_start: weekStart,
      lecturer_name: lecturerName || '',
      detail: detail || '',
      date: date || null,
      venue: venue || '',
      photo_url: photoUrl || ''
    })
    .select('*, subject:subjects(id, name, code, lecturer_name)')
    .single();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('lecturer_consultations').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findForWeek, create, remove };

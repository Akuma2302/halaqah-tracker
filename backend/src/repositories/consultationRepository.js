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

async function create(userId, { subjectId, weekStart, lecturerName, detail, date, venue, photoUrl, signatureUrl }) {
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
      photo_url: photoUrl || '',
      signature_url: signatureUrl || ''
    })
    .select('*, subject:subjects(id, name, code, lecturer_name)')
    .single();
  if (error) throw error;
  return data;
}

// Changes one of the user's own consultations; null if it isn't theirs. It stays in its week.
async function update(id, userId, { subjectId, lecturerName, detail, date, venue, photoUrl, signatureUrl }) {
  const { data, error } = await supabase
    .from('lecturer_consultations')
    .update({
      subject_id: subjectId || null,
      lecturer_name: lecturerName || '',
      detail: detail || '',
      date: date || null,
      venue: venue || '',
      photo_url: photoUrl || '',
      signature_url: signatureUrl || ''
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, subject:subjects(id, name, code, lecturer_name)')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('lecturer_consultations').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findForWeek, create, update, remove };

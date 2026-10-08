const supabase = require('../config/supabaseClient');

const WITH_SUBJECT = '*, subject:subjects(id, name, code, lecturer_name)';

async function findByUser(userId) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select(WITH_SUBJECT)
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

function toRow({ subjectId, title, dayOfWeek, startTime, endTime, venue, kind }) {
  return {
    subject_id: subjectId || null,
    title: title || '',
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    venue: venue || '',
    kind: kind || 'lecture'
  };
}

async function create(userId, entry) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .insert({ user_id: userId, ...toRow(entry) })
    .select(WITH_SUBJECT)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, userId, entry) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .update(toRow(entry))
    .eq('id', id)
    .eq('user_id', userId)
    .select(WITH_SUBJECT)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('timetable_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findByUser, create, update, remove };

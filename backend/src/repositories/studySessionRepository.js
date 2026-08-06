const supabase = require('../config/supabaseClient');

async function findForWeek(userId, weekStart) {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*, subject:subjects(id, name, code)')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

async function sumHoursForWeek(userId, weekStart) {
  const { data, error } = await supabase.from('study_sessions').select('hours').eq('user_id', userId).eq('week_start', weekStart);
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.hours), 0);
}

// Same as above but for a group scoreboard — one query for everyone instead
// of N queries, then summed per user on our side.
async function sumHoursForUsersAndWeek(userIds, weekStart) {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('study_sessions')
    .select('user_id, hours')
    .in('user_id', userIds)
    .eq('week_start', weekStart);
  if (error) throw error;

  const totals = {};
  (data || []).forEach((row) => {
    totals[row.user_id] = (totals[row.user_id] || 0) + Number(row.hours);
  });
  return totals;
}

async function create(userId, { subjectId, weekStart, date, categories, hours }) {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: userId,
      subject_id: subjectId || null,
      week_start: weekStart,
      date,
      categories: categories || [],
      hours
    })
    .select('*, subject:subjects(id, name, code)')
    .single();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('study_sessions').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

module.exports = { findForWeek, sumHoursForWeek, sumHoursForUsersAndWeek, create, remove };
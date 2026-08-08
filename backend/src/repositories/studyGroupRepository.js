const supabase = require('../config/supabaseClient');

async function inviteCodeExists(inviteCode) {
  const { data, error } = await supabase.from('study_groups').select('id').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw error;
  return !!data;
}

async function create({ name, subject, adminId, inviteCode, showMutabaah, showStudyHours }) {
  const { data: group, error } = await supabase
    .from('study_groups')
    .insert({
      name,
      subject: subject || '',
      admin_id: adminId,
      invite_code: inviteCode,
      show_mutabaah_scoreboard: showMutabaah !== false,
      show_study_hours_scoreboard: showStudyHours !== false
    })
    .select()
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from('study_group_members')
    .insert({ study_group_id: group.id, user_id: adminId, role: 'admin' });
  if (memberError) throw memberError;

  return group;
}

async function findById(id) {
  const { data, error } = await supabase.from('study_groups').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function findByInviteCode(inviteCode) {
  const { data, error } = await supabase.from('study_groups').select('*').eq('invite_code', inviteCode).maybeSingle();
  if (error) throw error;
  return data;
}

async function findAllForUser(userId) {
  const { data, error } = await supabase
    .from('study_group_members')
    .select('group:study_groups(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((row) => row.group).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function listMembers(studyGroupId) {
  const { data, error } = await supabase
    .from('study_group_members')
    .select('user_id, role, joined_at')
    .eq('study_group_id', studyGroupId);
  if (error) throw error;
  return data;
}

async function findMember(studyGroupId, userId) {
  const { data, error } = await supabase
    .from('study_group_members')
    .select('user_id, role')
    .eq('study_group_id', studyGroupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function addMember(studyGroupId, userId, role = 'member') {
  const { error } = await supabase
    .from('study_group_members')
    .insert({ study_group_id: studyGroupId, user_id: userId, role });
  if (error && error.code !== '23505') throw error;
}

async function addScheduleEntry(studyGroupId, { title, datetime, notes }) {
  const { data, error } = await supabase
    .from('study_group_schedule')
    .insert({ study_group_id: studyGroupId, title, datetime, notes: notes || '' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function listSchedule(studyGroupId) {
  const { data, error } = await supabase
    .from('study_group_schedule')
    .select('*')
    .eq('study_group_id', studyGroupId)
    .order('datetime', { ascending: true });
  if (error) throw error;
  return data;
}

async function findScheduleEntryById(id, studyGroupId) {
  const { data, error } = await supabase
    .from('study_group_schedule')
    .select('*')
    .eq('id', id)
    .eq('study_group_id', studyGroupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findDueUnremindedSessions(windowStart, windowEnd) {
  const { data, error } = await supabase
    .from('study_group_schedule')
    .select('*, study_group:study_groups(*)')
    .eq('reminded', false)
    .gte('datetime', windowStart.toISOString())
    .lte('datetime', windowEnd.toISOString());
  if (error) throw error;
  return data;
}

async function markSessionReminded(sessionId) {
  const { error } = await supabase.from('study_group_schedule').update({ reminded: true }).eq('id', sessionId);
  if (error) throw error;
}

module.exports = {
  inviteCodeExists,
  create,
  findById,
  findByInviteCode,
  findAllForUser,
  listMembers,
  findMember,
  addMember,
  addScheduleEntry,
  listSchedule,
  findScheduleEntryById,
  findDueUnremindedSessions,
  markSessionReminded
};
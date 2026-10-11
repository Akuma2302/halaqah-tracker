const supabase = require('../config/supabaseClient');

async function findByMentor(mentorId) {
  const { data, error } = await supabase
    .from('mentoring_groups')
    .select('*')
    .eq('mentor_id', mentorId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('mentoring_groups').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

function toRow({ name, dayOfWeek, startTime, venue }) {
  return {
    name,
    day_of_week: dayOfWeek === null || dayOfWeek === undefined ? null : dayOfWeek,
    start_time: startTime || null,
    venue: venue || ''
  };
}

async function create(mentorId, group) {
  const { data, error } = await supabase
    .from('mentoring_groups')
    .insert({ mentor_id: mentorId, ...toRow(group) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function update(id, mentorId, group) {
  const { data, error } = await supabase
    .from('mentoring_groups')
    .update(toRow(group))
    .eq('id', id)
    .eq('mentor_id', mentorId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Mentees in the group go back to "not in a group" (the column is set null).
async function remove(id, mentorId) {
  const { error } = await supabase.from('mentoring_groups').delete().eq('id', id).eq('mentor_id', mentorId);
  if (error) throw error;
}

// Make the group's members exactly `memberIds`. Only this mentor's own
// mentees can be put in, whatever ids the client sends.
async function setMembers(groupId, mentorId, memberIds) {
  const { error: clearError } = await supabase
    .from('users')
    .update({ mentoring_group_id: null })
    .eq('mentor_id', mentorId)
    .eq('mentoring_group_id', groupId);
  if (clearError) throw clearError;
  if (!memberIds.length) return;
  const { error } = await supabase
    .from('users')
    .update({ mentoring_group_id: groupId })
    .eq('mentor_id', mentorId)
    .in('id', memberIds);
  if (error) throw error;
}

function serialize(row) {
  return {
    _id: row.id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    venue: row.venue || ''
  };
}

module.exports = { findByMentor, findById, create, update, remove, setMembers, serialize };

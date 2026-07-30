const supabase = require('../config/supabaseClient');

async function create({ studyGroupId, senderId, content, attachmentUrl, attachmentType }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      study_group_id: studyGroupId,
      sender_id: senderId,
      content: content || '',
      attachment_url: attachmentUrl || '',
      attachment_type: attachmentType || ''
    })
    .select('*, sender:users(id, name, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

async function findByStudyGroup(studyGroupId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:users(id, name, avatar_url)')
    .eq('study_group_id', studyGroupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = { create, findByStudyGroup };

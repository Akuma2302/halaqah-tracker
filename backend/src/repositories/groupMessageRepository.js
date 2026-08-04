const supabase = require('../config/supabaseClient');

async function create({ groupId, senderId, content, attachmentUrl, attachmentType }) {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
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

async function findByGroup(groupId) {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*, sender:users(id, name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = { create, findByGroup };

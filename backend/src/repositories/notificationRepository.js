const supabase = require('../config/supabaseClient');

async function create({ userId, type, title, body, relatedId }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, body: body || '', related_id: relatedId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createMany(notifications) {
  if (!notifications.length) return [];
  const { data, error } = await supabase
    .from('notifications')
    .insert(
      notifications.map((n) => ({
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body || '',
        related_id: n.relatedId || null
      }))
    )
    .select();
  if (error) throw error;
  return data;
}

async function findByUser(userId, limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function markRead(id, userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { create, createMany, findByUser, markRead };

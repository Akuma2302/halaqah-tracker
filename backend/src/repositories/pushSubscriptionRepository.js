const supabase = require('../config/supabaseClient');

async function upsert(userId, { endpoint, keys }) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );
  if (error) throw error;
}

async function findByUserId(userId) {
  const { data, error } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
  if (error) throw error;
  return data;
}

async function removeByEndpoint(endpoint) {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

module.exports = { upsert, findByUserId, removeByEndpoint };
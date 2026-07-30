const supabase = require('../config/supabaseClient');

async function findAll() {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = { findAll };

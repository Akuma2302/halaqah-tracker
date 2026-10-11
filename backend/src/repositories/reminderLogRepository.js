const supabase = require('../config/supabaseClient');

// Inserts (user_id, date, slot) rows, skipping ones that already exist, and
// returns only the newly inserted rows. Whoever inserts a row "owns" that
// reminder, so two concurrent runs can never both send it.
async function claim(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('mutabaah_reminders_sent')
    .upsert(rows, { onConflict: 'user_id,date,slot', ignoreDuplicates: true })
    .select('user_id, date, slot');
  if (error) throw error;
  return data;
}

// The same idea for assessment reminders: (user_id, key) rows, returning only
// the ones this call inserted.
async function claimAssessment(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from('assessment_reminders_sent')
    .upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true })
    .select('user_id, key');
  if (error) throw error;
  return data;
}

module.exports = { claim, claimAssessment };

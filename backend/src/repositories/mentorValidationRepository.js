const supabase = require('../config/supabaseClient');

async function findForWeek(userId, weekStart) {
  const { data, error } = await supabase
    .from('mentor_validations')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsert(userId, weekStart, { isValidated, validatedDate }) {
  const { data, error } = await supabase
    .from('mentor_validations')
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        is_validated: isValidated,
        validated_date: validatedDate || (isValidated ? new Date().toISOString().slice(0, 10) : null),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,week_start' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = { findForWeek, upsert };

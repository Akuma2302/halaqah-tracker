const supabase = require('../config/supabaseClient');

const WITH_SUBJECT = '*, subject:subjects(id, name, code, lecturer_name, is_visible)';

async function findByUser(userId) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select(WITH_SUBJECT)
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('timetable_entries').select(WITH_SUBJECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Entries other people own that this user has been added to.
async function findSharedWith(userId) {
  const { data: links, error: linkError } = await supabase.from('timetable_participants').select('entry_id').eq('user_id', userId);
  if (linkError) throw linkError;
  if (!links.length) return [];
  const { data, error } = await supabase
    .from('timetable_entries')
    .select(WITH_SUBJECT)
    .in(
      'id',
      links.map((l) => l.entry_id)
    )
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

// { entry_id, user_id } rows for the given entries.
async function findParticipants(entryIds) {
  if (!entryIds.length) return [];
  const { data, error } = await supabase.from('timetable_participants').select('entry_id, user_id').in('entry_id', entryIds);
  if (error) throw error;
  return data;
}

// Make the entry's participants exactly `userIds`.
async function setParticipants(entryId, userIds) {
  const { error: clearError } = await supabase.from('timetable_participants').delete().eq('entry_id', entryId);
  if (clearError) throw clearError;
  if (!userIds.length) return;
  const { error } = await supabase.from('timetable_participants').insert(userIds.map((user_id) => ({ entry_id: entryId, user_id })));
  if (error) throw error;
}

async function removeParticipant(entryId, userId) {
  const { error } = await supabase.from('timetable_participants').delete().eq('entry_id', entryId).eq('user_id', userId);
  if (error) throw error;
}

// Reminders and the custom type are only touched when they are sent, so the
// subject editor (which knows nothing of them) leaves them as they are.
function toRow({ subjectId, title, dayOfWeek, startTime, endTime, venue, kind, startDate, endDate, reminders, customKind }) {
  return {
    subject_id: subjectId || null,
    title: title || '',
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    venue: venue || '',
    kind: kind || 'lecture',
    start_date: startDate || null,
    end_date: startDate ? endDate || startDate : null,
    ...(reminders !== undefined ? { reminders } : {}),
    ...(customKind !== undefined ? { custom_kind: kind === 'other' ? customKind : '' } : {})
  };
}

// Every entry that has at least one reminder set, whoever owns it.
async function findWithReminders() {
  const { data, error } = await supabase.from('timetable_entries').select(WITH_SUBJECT).neq('reminders', '[]');
  if (error) throw error;
  return data;
}

async function create(userId, entry) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .insert({ user_id: userId, ...toRow(entry) })
    .select(WITH_SUBJECT)
    .single();
  if (error) throw error;
  return data;
}

async function update(id, userId, entry) {
  const { data, error } = await supabase
    .from('timetable_entries')
    .update(toRow(entry))
    .eq('id', id)
    .eq('user_id', userId)
    .select(WITH_SUBJECT)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function remove(id, userId) {
  const { error } = await supabase.from('timetable_entries').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// A weekly entry: take it off one date, or end it after a date.
async function setRepeat(id, userId, { skipDates, repeatUntil }) {
  const { error } = await supabase
    .from('timetable_entries')
    .update({ ...(skipDates !== undefined ? { skip_dates: skipDates } : {}), ...(repeatUntil !== undefined ? { repeat_until: repeatUntil } : {}) })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// Postgres returns times as "09:00:00"; the app works in "09:00".
function serialize(row) {
  return {
    _id: row.id,
    title: row.title,
    dayOfWeek: row.day_of_week,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    venue: row.venue,
    kind: row.kind,
    // The user's own type, when the kind is 'other'.
    customKind: row.custom_kind || '',
    // A one-off event has dates; a weekly one has none.
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    // Minutes before the start to send a reminder.
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    // A weekly entry: dates it was taken off, and the last date it happens.
    skipDates: Array.isArray(row.skip_dates) ? row.skip_dates : [],
    repeatUntil: row.repeat_until ? String(row.repeat_until).slice(0, 10) : null,
    subject: row.subject
      ? {
          _id: row.subject.id,
          name: row.subject.name,
          code: row.subject.code,
          lecturerName: row.subject.lecturer_name,
          // A hidden subject's classes are left out of the timetable (but still edited in Subjects).
          isVisible: row.subject.is_visible !== false
        }
      : null
  };
}

module.exports = {
  findByUser,
  findById,
  findSharedWith,
  findParticipants,
  setParticipants,
  removeParticipant,
  create,
  update,
  remove,
  setRepeat,
  findWithReminders,
  serialize
};

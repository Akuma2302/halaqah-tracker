const supabase = require('../config/supabaseClient');

const WITH_UPLOADER = '*, uploader:users(id, name)';

// Characters that mean something inside a PostgREST filter are dropped from
// what people type, so a search can only ever be a plain "contains".
const clean = (text) =>
  String(text || '')
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

// Newest first. `q` looks in the subject, its code, the course and the
// university; `university` must match exactly; `course` is a "contains".
async function search({ q, university, course, limit = 100 }) {
  let query = supabase.from('past_papers').select(WITH_UPLOADER).order('created_at', { ascending: false }).limit(limit);
  const text = clean(q);
  if (text) {
    const like = `%${text}%`;
    query = query.or(`subject.ilike.${like},subject_code.ilike.${like},course.ilike.${like},university.ilike.${like}`);
  }
  if (clean(university)) query = query.eq('university', String(university).trim().slice(0, 160));
  if (clean(course)) query = query.ilike('course', `%${clean(course)}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from('past_papers').select(WITH_UPLOADER).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function create(row) {
  const { data, error } = await supabase.from('past_papers').insert(row).select(WITH_UPLOADER).single();
  if (error) throw error;
  return data;
}

async function remove(id, uploaderId) {
  const { error } = await supabase.from('past_papers').delete().eq('id', id).eq('uploader_id', uploaderId);
  if (error) throw error;
}

function serialize(row) {
  return {
    _id: row.id,
    university: row.university,
    course: row.course,
    subject: row.subject,
    subjectCode: row.subject_code,
    year: row.year,
    paperType: row.paper_type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    // Only the first name is shown beside a paper.
    uploader: row.uploader ? { _id: row.uploader.id, name: String(row.uploader.name || '').split(' ')[0] } : null
  };
}

module.exports = { search, findById, create, remove, serialize };

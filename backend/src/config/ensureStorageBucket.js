const supabase = require('./supabaseClient');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'halaqah-tracker';

// Creates the storage bucket used for chat attachments if it doesn't exist yet.
// Public so uploaded files can be served via their public URL (same as the
// old Cloudinary setup) — nothing sensitive is stored in it.
async function ensureStorageBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = (buckets || []).some((b) => b.name === BUCKET);
  if (exists) {
    console.log(`Supabase Storage bucket "${BUCKET}" already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB'
  });
  if (createError) throw createError;
  console.log(`Created Supabase Storage bucket "${BUCKET}".`);
}

module.exports = ensureStorageBucket;

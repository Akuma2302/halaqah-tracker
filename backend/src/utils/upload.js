const multer = require('multer');
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'halaqah-tracker';

// Files sit in memory just long enough to stream to Supabase Storage - Render's
// disk is wiped on every redeploy, so nothing is ever written to it on our side.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function uploadBufferToSupabase(buffer, originalName, mimetype) {
  const ext = (originalName || '').split('.').pop();
  const path = `study-groups/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext ? `.${ext}` : ''}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

module.exports = { upload, uploadBufferToSupabase };

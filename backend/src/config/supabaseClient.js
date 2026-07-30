const { createClient } = require('@supabase/supabase-js');

// Server-side client using the service role key — bypasses Row Level Security,
// which is fine here because every table is only ever reached through our own
// authenticated Express routes, never directly from the browser.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;

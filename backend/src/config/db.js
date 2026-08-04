const { Pool } = require('pg');

// Raw Postgres connection (Supabase's connection string) — used only for
// running schema migrations (config/migrate.js). All app data access goes
// through the Supabase client instead (see config/supabaseClient.js).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;

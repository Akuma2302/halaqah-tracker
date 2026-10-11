const { Pool } = require('pg');

// Raw Postgres connection (Supabase's connection string) — used for running
// schema migrations (config/migrate.js) and for the admin dashboard's
// app-wide counts (services/adminService.js). All other data access goes
// through the Supabase client instead (see config/supabaseClient.js).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;

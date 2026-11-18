const fs = require('fs');
const path = require('path');
const pool = require('./db');

const SCHEMA_PATH = path.join(__dirname, '../../supabase/schema.sql');

// Applies backend/supabase/schema.sql against the Supabase Postgres database.
// Every statement in that file uses "if not exists", so this is safe to run
// on every boot — the first run creates everything, later runs are no-ops.
async function runMigrations() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    // Supabase's API keeps its own list of tables and columns; tell it to
    // read them again so new ones (made just now) can be used straight away.
    await client.query("notify pgrst, 'reload schema'");
    console.log('Supabase schema is up to date (tables created/verified from backend/supabase/schema.sql).');
  } finally {
    client.release();
  }
}

module.exports = runMigrations;

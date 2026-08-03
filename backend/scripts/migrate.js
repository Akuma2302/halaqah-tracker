require('dotenv').config();
const runMigrations = require('../src/config/migrate');
const ensureStorageBucket = require('../src/config/ensureStorageBucket');

// Standalone entry point: `npm run db:migrate`. Useful for setting up the
// database/storage once locally or in CI — but the server also runs this
// automatically on every boot, so it's not a required manual step.
runMigrations()
  .then(() => ensureStorageBucket())
  .then(() => {
    console.log('Supabase setup complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });

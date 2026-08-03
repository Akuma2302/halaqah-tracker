require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const sessionMiddleware = require('./config/session');
const runMigrations = require('./config/migrate');
const ensureStorageBucket = require('./config/ensureStorageBucket');
const registerSocketHandlers = require('./sockets/chatSocket');
const startReminderJob = require('./jobs/reminderCheck');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true }
});

// Needed so secure cookies work correctly behind Render's proxy
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/mutabaah', require('./routes/mutabaah'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/study-groups', require('./routes/studyGroups'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/content', require('./routes/content'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

registerSocketHandlers(io, sessionMiddleware);
startReminderJob();

// In production the frontend is deployed separately on Netlify, so this backend
// (Render) only serves the JSON API + websocket — no static file serving here.
// (If you ever want a single-service deploy instead, see README "Alternative: single-service deploy".)

const PORT = process.env.PORT || 5000;

// Sets up the Supabase database schema and storage bucket automatically —
// no manual steps in the Supabase dashboard needed. Run sequentially (schema
// first) rather than in parallel, so a storage hiccup can't cut off an
// in-flight migration. Safe to run on every boot.
runMigrations()
  .then(() => ensureStorageBucket())
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to set up Supabase database/storage:', err.message);
    process.exit(1);
  });

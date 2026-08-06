require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const runMigrations = require('./config/migrate');
const ensureStorageBucket = require('./config/ensureStorageBucket');
const registerSocketHandlers = require('./sockets/chatSocket');
const startReminderJob = require('./jobs/reminderCheck');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL }
});

// Auth is via Bearer token (Authorization header), not cookies, so there's
// no cookie/session state for CORS to carry across origins — see
// utils/authToken.js for why (iOS Safari blocks cross-site cookies outright).
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/mutabaah', require('./routes/mutabaah'));
app.use('/api/study-groups', require('./routes/studyGroups'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/content', require('./routes/content'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Catches every error forwarded by asyncHandler (see middlewares/asyncHandler.js)
// so a failure in one request returns a clean error response instead of
// crashing the whole process and dropping every other active connection.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

registerSocketHandlers(io);
startReminderJob();

// In production the frontend is deployed separately on Netlify, so this backend
// (Render) only serves the JSON API + websocket — no static file serving here.

const PORT = process.env.PORT || 5000;

runMigrations()
  .then(() => ensureStorageBucket())
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to set up Supabase database/storage:', err.message);
    process.exit(1);
  });
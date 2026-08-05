# Halaqah Tracker

A mutabaah (daily deeds) tracker with accountability groups, study groups, live
chat, and scheduled-session reminders.

```
halaqah-tracker/
├── frontend/   React + Vite app -> deploy to Netlify
└── backend/    Express + Socket.io API -> deploy to Render, data in Supabase
```

## Stack

- **Frontend:** React, Vite, React Router - hosted on **Netlify**
- **Backend:** Express, Socket.io - hosted on **Render**
- **Database + file storage:** **Supabase** (Postgres + Storage)
- **Auth:** Google Sign-In, stateless Bearer token (JWT) — not a cookie, so it works reliably across the Netlify/Render domain split, including iOS Safari, which blocks cross-site cookies outright

This project used to run on MongoDB Atlas with everything in one Render
service. It's now split into two services with Postgres (Supabase) as the
database - see "What changed" at the bottom if you're curious.

---

## 1. Set up Supabase (database + storage)

Tables and the storage bucket are created **from code**, not by hand — no
SQL editor, no manual bucket setup. The backend does this automatically on
every boot (`backend/src/config/migrate.js` + `ensureStorageBucket.js`), and
you can also trigger it manually with `npm run db:migrate`.

1. Create a project at https://supabase.com (free tier is fine).
2. Collect three values you'll need for env vars:
   - **Project URL** and **service_role key** - Project Settings -> API
   - **Connection string** (Session pooler, URI format) - Project Settings ->
     Database -> Connection string. This is your `DATABASE_URL`.
3. That's it — once the backend has those env vars and starts up (locally or
   on Render), it connects to Postgres and:
   - runs `backend/supabase/schema.sql` to create every table (`users`,
     `groups`, `study_groups`, `messages`, `mutabaah_entries`,
     `notifications`, `content_items`, etc.) with indexes and RLS enabled
     — safe to re-run, every statement uses "if not exists"
   - creates the `halaqah-tracker` public Storage bucket used for chat
     attachments, if it doesn't already exist

If you ever want to see it happen without starting the whole server:
`cd backend && npm run db:migrate`.

## 2. Set up Google Sign-In

If you don't already have one: console.cloud.google.com/apis/credentials
-> Create OAuth client ID -> Web application -> add your Netlify URL and
`http://localhost:5173` as authorized origins. Copy the **Client ID**.

## 3. Deploy the backend to Render

1. Push this repo to GitHub.
2. In Render: **New -> Web Service**, connect the repo,
   set **Root Directory** to `backend`.
3. Build command: `npm install`. Start command: `npm start`.
   (Or just use the included `render.yaml` - Render will detect it via
   "New -> Blueprint" and pre-fill the service.)
4. Add the environment variables from `backend/.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
   - `DATABASE_URL` (the Supabase session-pooler string from step 1)
   - `GOOGLE_CLIENT_ID`, `SESSION_SECRET` (any long random string)
   - `CLIENT_URL` -> your Netlify URL (set this after step 4 below, then redeploy)
   - `NODE_ENV=production`
5. Deploy. Check `https://your-backend.onrender.com/api/health` returns
   `{"ok":true}`.

## 4. Deploy the frontend to Netlify

1. In Netlify: **Add new site -> Import an existing project**, connect the
   repo. Leave the build command / publish directory / base directory
   fields **blank** in the setup wizard — `netlify.toml` at the repo root
   already sets `base = "frontend"`, `command = "npm run build"`, and
   `publish = "dist"`, so Netlify picks those up automatically.
2. Add environment variables (Site configuration -> Environment variables):
   - `VITE_GOOGLE_CLIENT_ID` - same Google client ID as above
   - `VITE_API_URL` - your Render backend URL, e.g. `https://your-backend.onrender.com`
3. Deploy. Then go back to Render and set `CLIENT_URL` to this Netlify URL,
   and redeploy the backend so CORS/Socket.io allow it.

> **Build fails with `npm error enoent ... open '/opt/build/repo/package.json'`?**
> Netlify tried to run the build from the repo root instead of `frontend/`.
> This usually means the dashboard's own Build command / Publish directory /
> Base directory fields were filled in manually (they override
> `netlify.toml`). Go to **Site configuration -> Build & deploy -> Build
> settings -> Edit settings** and clear all three fields so `netlify.toml`
> takes over, then trigger a new deploy.

## 5. Local development

```bash
# backend
cd backend
cp .env.example .env   # fill in Supabase + Google values, leave CLIENT_URL as localhost
npm install
npm run dev             # http://localhost:5000

# frontend (separate terminal)
cd frontend
cp .env.example .env    # fill in VITE_GOOGLE_CLIENT_ID, leave VITE_API_URL unset
npm install
npm run dev              # http://localhost:5173, proxies /api to :5000
```

---

## What changed from the original version

- **New: Academic Journal + Subject List tabs.** Weekly study-hour tracking
  (Sun-Sat, 10hr/week target ring shown on both the Dashboard and the
  Academic Journal page), a Subject List with per-subject assessment
  breakdowns, an assignments/projects overview, and a week-scoped log split
  into four sections (Study Hour, Question Practice, Lecturer Consultation
  with photo upload, and self-ticked Mentor Validation), plus a weekly report
  downloadable as PDF or Excel. Backend: `backend/src/routes/academic.js`
  and everything under `services/`, `repositories/`, `controllers/` prefixed
  accordingly. New tables in `backend/supabase/schema.sql`: `subjects`,
  `subject_assessments`, `assignments`, `study_sessions`,
  `question_practice`, `lecturer_consultations`, `mentor_validations`.

- **Database:** MongoDB/Mongoose -> **Supabase Postgres**. Schema lives in
  `backend/supabase/schema.sql` and is applied automatically from code on
  boot (`backend/src/config/migrate.js`) — no manual SQL editor step. Data
  access goes through a repository layer (`backend/src/repositories`) using
  `@supabase/supabase-js`.
- **File uploads:** Cloudinary -> **Supabase Storage**, with the bucket also
  created automatically from code (`backend/src/config/ensureStorageBucket.js`).
- **Sessions:** Mongo-backed sessions -> stateless JWT Bearer tokens (not
  cookies at all). Frontend/backend live on different domains (Netlify +
  Render); cookies across that split get silently blocked by iOS Safari's
  cross-site cookie policy (ITP) no matter what SameSite is set to, which
  broke every authenticated request on iPhone/iPad specifically. A token in
  the `Authorization` header isn't a cookie, so this is immune to that
  entirely — same behavior on every platform (Windows, Android, iOS, desktop
  Safari). See `backend/src/utils/authToken.js`.
- **API response shapes are unchanged** - a serializer layer
  (`backend/src/utils/serializers.js`) maps Postgres rows back into the same
  JSON shape (`_id`, camelCase fields, populated refs) the frontend already
  expects, so **no frontend code had to change** for the DB migration.
- **Deployment:** one combined Render service (serving the built React app
  statically) -> separate **Netlify** (frontend) and **Render** (backend)
  services, communicating over `VITE_API_URL` / `CLIENT_URL` and CORS with
  credentials.
- **Folder structure:** reorganized to match standard frontend
  (components/layout/pages/features/hooks/context/redux/services/utils)
  and backend (config/controllers/routes/services/middlewares/models/
  repositories/utils/validators) conventions.
- **Validation:** added a `zod`-based validators layer on the backend.

### Alternative: single-service deploy
If you'd rather deploy the backend and frontend together as one Render
service (like the original setup) instead of Netlify + Render: build the
frontend (`npm run build` in `frontend/`), copy `frontend/dist` next to
`backend/`, and add static-serving back into `backend/src/server.js` (there's
a comment marking where it used to live). Not required - the two-service
setup above is the default this repo is configured for.

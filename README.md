# Halaqah Tracker

A mutabaah (daily deeds) tracker with accountability groups, study groups, live
chat, and scheduled-session reminders.

```
halaqah-tracker/
├── frontend/   React + Vite app -> deploy to Vercel
└── backend/    Express + Socket.io API -> deploy to Render, data in Supabase
```

## Stack

- **Frontend:** React, Vite, React Router - hosted on **Vercel**
- **Backend:** Express, Socket.io - hosted on **Render**
- **Database + file storage:** **Supabase** (Postgres + Storage)
- **Auth:** Google Sign-In, session cookie stored in Supabase Postgres

This project used to run on MongoDB Atlas with everything in one Render
service. It's now split into two services with Postgres (Supabase) as the
database - see "What changed" at the bottom if you're curious.

---

## 1. Set up Supabase (database + storage)

1. Create a project at https://supabase.com (free tier is fine).
2. Open **SQL Editor -> New query**, paste the contents of
   `backend/supabase/schema.sql`, and run it. This creates every table
   (`users`, `groups`, `study_groups`, `messages`, `mutabaah_entries`,
   `notifications`, `content_items`, etc.) with indexes and RLS enabled.
3. Go to **Storage -> Create a new bucket**, name it `halaqah-tracker`, and
   mark it **public** (chat attachments are served via public URL, same as
   the old Cloudinary setup).
4. Collect three values you'll need for env vars:
   - **Project URL** and **service_role key** - Project Settings -> API
   - **Connection string** (Session pooler, URI format) - Project Settings ->
     Database -> Connection string. This is your `DATABASE_URL`.

## 2. Set up Google Sign-In

If you don't already have one: console.cloud.google.com/apis/credentials
-> Create OAuth client ID -> Web application -> add your Vercel URL and
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
   - `CLIENT_URL` -> your Vercel URL (set this after step 4 below, then redeploy)
   - `NODE_ENV=production`
5. Deploy. Check `https://your-backend.onrender.com/api/health` returns
   `{"ok":true}`.

## 4. Deploy the frontend to Vercel

1. In Vercel: **New Project**, import the repo, set
   **Root Directory** to `frontend`.
2. Framework preset: Vite. Vercel will pick up `frontend/vercel.json` for
   build/output settings automatically.
3. Add environment variables:
   - `VITE_GOOGLE_CLIENT_ID` - same Google client ID as above
   - `VITE_API_URL` - your Render backend URL, e.g. `https://your-backend.onrender.com`
4. Deploy. Then go back to Render and set `CLIENT_URL` to this Vercel URL,
   and redeploy the backend so CORS/cookies/Socket.io allow it.

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

- **Database:** MongoDB/Mongoose -> **Supabase Postgres**. Schema lives in
  `backend/supabase/schema.sql`. Data access goes through a
  repository layer (`backend/src/repositories`) using `@supabase/supabase-js`.
- **File uploads:** Cloudinary -> **Supabase Storage**.
- **Sessions:** Mongo-backed sessions -> Postgres-backed sessions via
  `connect-pg-simple`, using the same Supabase database.
- **API response shapes are unchanged** - a serializer layer
  (`backend/src/utils/serializers.js`) maps Postgres rows back into the same
  JSON shape (`_id`, camelCase fields, populated refs) the frontend already
  expects, so **no frontend code had to change** for the DB migration.
- **Deployment:** one combined Render service (serving the built React app
  statically) -> separate **Vercel** (frontend) and **Render** (backend)
  services, communicating over `VITE_API_URL` / `CLIENT_URL` and CORS with
  credentials.
- **Folder structure:** reorganized to match standard frontend
  (components/layout/pages/features/hooks/context/redux/services/utils)
  and backend (config/controllers/routes/services/middlewares/models/
  repositories/utils/validators) conventions.
- **Validation:** added a `zod`-based validators layer on the backend.

### Alternative: single-service deploy
If you'd rather deploy the backend and frontend together as one Render
service (like the original setup) instead of Vercel + Render: build the
frontend (`npm run build` in `frontend/`), copy `frontend/dist` next to
`backend/`, and add static-serving back into `backend/src/server.js` (there's
a comment marking where it used to live). Not required - the two-service
setup above is the default this repo is configured for.

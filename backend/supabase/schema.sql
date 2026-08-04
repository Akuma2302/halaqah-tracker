-- Halaqah Tracker — Supabase Postgres schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- before starting the backend for the first time.

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------- users ----------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_id text unique not null,
  email text not null,
  name text not null,
  kampus text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- accountability (mutabaah) groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references users(id) on delete cascade,
  invite_code text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null default '',
  attachment_url text not null default '',
  attachment_type text not null default '' check (attachment_type in ('image', 'file', '')),
  created_at timestamptz not null default now()
);

-- ---------- study groups ----------
create table if not exists study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  admin_id uuid not null references users(id) on delete cascade,
  invite_code text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists study_group_members (
  study_group_id uuid not null references study_groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (study_group_id, user_id)
);

create table if not exists study_group_schedule (
  id uuid primary key default gen_random_uuid(),
  study_group_id uuid not null references study_groups(id) on delete cascade,
  title text not null,
  datetime timestamptz not null,
  notes text default '',
  reminded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  study_group_id uuid not null references study_groups(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null default '',
  attachment_url text not null default '',
  attachment_type text not null default '' check (attachment_type in ('image', 'file', '')),
  created_at timestamptz not null default now()
);

-- ---------- daily mutabaah checklist ----------
create table if not exists mutabaah_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  tahajud boolean not null default false,
  subuh_berjemaah boolean not null default false,
  mathurat_pagi boolean not null default false,
  mathurat_petang boolean not null default false,
  dhuha boolean not null default false,
  tilawah boolean not null default false,
  zikir boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- notifications ----------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('reminder', 'group_invite', 'session_scheduled', 'message')),
  title text not null,
  body text not null default '',
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- reference content (mathurat / zikir / doa) ----------
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('mathurat_pagi', 'mathurat_petang', 'zikir', 'doa')),
  title text not null,
  arabic_text text not null default '',
  transliteration text not null default '',
  translation text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- helpful indexes ----------
create index if not exists idx_group_members_user on group_members(user_id);
create index if not exists idx_group_messages_group on group_messages(group_id, created_at);
create index if not exists idx_study_group_members_user on study_group_members(user_id);
create index if not exists idx_messages_study_group on messages(study_group_id, created_at);
create index if not exists idx_mutabaah_user_date on mutabaah_entries(user_id, date);
create index if not exists idx_notifications_user on notifications(user_id, created_at);
create index if not exists idx_schedule_datetime on study_group_schedule(datetime, reminded);

-- ---------- row level security ----------
-- The backend talks to Postgres with the service_role key (see config/supabaseClient.js),
-- which always bypasses RLS. Enabling RLS with no policies just guarantees that nobody
-- can read/write these tables using the public anon key directly from a browser.
alter table users enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_messages enable row level security;
alter table study_groups enable row level security;
alter table study_group_members enable row level security;
alter table study_group_schedule enable row level security;
alter table messages enable row level security;
alter table mutabaah_entries enable row level security;
alter table notifications enable row level security;
alter table content_items enable row level security;

-- ---------- schema upgrades for already-deployed databases ----------
-- CREATE TABLE IF NOT EXISTS above won't retroactively change a table that
-- already exists, so constraint widenings need to be applied explicitly here.
-- Safe to run every boot: it just re-asserts the same (or newer) rule.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reminder', 'group_invite', 'session_scheduled', 'message'));

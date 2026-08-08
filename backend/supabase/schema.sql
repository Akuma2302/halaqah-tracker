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
  show_mutabaah_scoreboard boolean not null default true,
  show_study_hours_scoreboard boolean not null default true,
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

-- ---------- academic journal ----------
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  code text not null default '',
  lecturer_name text not null default '',
  credit_hour numeric not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subject_assessments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  type text not null check (type in ('quiz', 'test', 'assignment', 'project', 'presentation', 'final_exam')),
  percentage numeric not null default 0,
  due_date date,
  progress_percentage numeric not null default 0,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  type text not null default 'assignment' check (type in ('assignment', 'project')),
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  week_start date not null,
  date date not null,
  categories text[] not null default '{}',
  hours numeric not null check (hours >= 1 and hours <= 24),
  created_at timestamptz not null default now()
);

create table if not exists question_practice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  week_start date not null,
  question_count integer not null default 0,
  is_validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists lecturer_consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  week_start date not null,
  lecturer_name text not null default '',
  detail text not null default '',
  date date,
  venue text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists mentor_validations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  is_validated boolean not null default false,
  validated_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------- group folders (personal organization, per user) ----------
create table if not exists group_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists group_folder_items (
  folder_id uuid not null references group_folders(id) on delete cascade,
  study_group_id uuid not null references study_groups(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (folder_id, study_group_id)
);

-- ---------- push notification subscriptions (one row per device) ----------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);
create index if not exists idx_group_folders_user on group_folders(user_id);
create index if not exists idx_group_folder_items_group on group_folder_items(study_group_id);
create index if not exists idx_subjects_user on subjects(user_id);
create index if not exists idx_subject_assessments_subject on subject_assessments(subject_id);
create index if not exists idx_assignments_user on assignments(user_id, due_date);
create index if not exists idx_study_sessions_user_week on study_sessions(user_id, week_start);
create index if not exists idx_question_practice_user_week on question_practice(user_id, week_start);
create index if not exists idx_consultations_user_week on lecturer_consultations(user_id, week_start);
create index if not exists idx_mentor_validations_user_week on mentor_validations(user_id, week_start);

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
alter table subjects enable row level security;
alter table subject_assessments enable row level security;
alter table assignments enable row level security;
alter table study_sessions enable row level security;
alter table question_practice enable row level security;
alter table lecturer_consultations enable row level security;
alter table mentor_validations enable row level security;
alter table group_folders enable row level security;
alter table group_folder_items enable row level security;
alter table push_subscriptions enable row level security;

-- ---------- schema upgrades for already-deployed databases ----------
-- CREATE TABLE IF NOT EXISTS above won't retroactively change a table that
-- already exists, so constraint widenings need to be applied explicitly here.
-- Safe to run every boot: it just re-asserts the same (or newer) rule.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('reminder', 'group_invite', 'session_scheduled', 'message'));

alter table subject_assessments add column if not exists due_date date;
alter table subject_assessments add column if not exists progress_percentage numeric not null default 0;
alter table subject_assessments add column if not exists is_done boolean not null default false;
alter table study_groups add column if not exists show_mutabaah_scoreboard boolean not null default true;
alter table study_groups add column if not exists show_study_hours_scoreboard boolean not null default true;

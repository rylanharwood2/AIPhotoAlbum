-- Run this entire file in your Supabase SQL editor
-- Dashboard → SQL Editor → New Query → paste and run

-- Users (created on first Google login)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_id text unique not null,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Sessions (simple token-based auth)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- Photos (one row per photo, curated or not)
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  cloudinary_url text not null,
  cloudinary_public_id text not null,
  filename text not null,
  taken_at timestamptz,
  is_curated boolean default false,
  curation_reason text,
  curation_order integer,
  created_at timestamptz default now()
);

-- Daily rate limiting (one row per calendar day)
create table if not exists rate_limits (
  date date primary key,
  total_cost_usd numeric(10, 6) default 0,
  updated_at timestamptz default now()
);

-- Indexes for common lookups
create index if not exists sessions_token_idx on sessions(token);
create index if not exists trips_user_id_idx on trips(user_id);
create index if not exists photos_trip_id_idx on photos(trip_id);

-- Add Google token columns to users table
-- Run these separately if you've already run the initial schema
alter table users add column if not exists google_access_token text;
alter table users add column if not exists google_refresh_token text;

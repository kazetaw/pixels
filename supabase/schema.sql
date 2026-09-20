-- ============================================================
-- Factory Resource Calculator — Supabase Schema
-- Run this entire script in Supabase SQL Editor once.
-- ============================================================

-- ── Enable uuid extension (already on by default in Supabase) ──
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. machines
-- ────────────────────────────────────────────────────────────
create table if not exists machines (
  machine_id      uuid        primary key default gen_random_uuid(),
  machine_name    text        not null,
  floor_number    integer     not null check (floor_number >= 1),
  occupation      text        check (occupation in (
                                'วิศวะกร','หมอ','เชฟ','ไอดอล','เกษตร','ทุกอาชีพ'
                              )),
  image_url       text,           -- Supabase Storage public URL (nullable)
  created_at      timestamptz default now()
);

-- unique name (case-insensitive, NFKC-normalised handled in app layer)
create unique index if not exists machines_name_unique
  on machines (lower(machine_name));

-- ────────────────────────────────────────────────────────────
-- 2. recipes
-- ────────────────────────────────────────────────────────────
create table if not exists recipes (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  machine_id      uuid        references machines(machine_id) on delete set null,
  time_per_unit   text,           -- "HH:MM:SS" string, nullable
  ingredients     jsonb       not null default '{}',  -- { item_id: quantity }
  image_url       text,           -- Supabase Storage public URL (nullable)
  created_at      timestamptz default now()
);

create unique index if not exists recipes_name_unique
  on recipes (lower(name));

-- ────────────────────────────────────────────────────────────
-- 3. stocks  (one row per item — raw material OR recipe product)
-- ────────────────────────────────────────────────────────────
create table if not exists stocks (
  item_id         text        primary key,  -- recipe UUID or raw-material name
  quantity        integer     not null default 0 check (quantity >= 0)
);

-- ────────────────────────────────────────────────────────────
-- 4. stock_images  (one row per raw-material item)
-- ────────────────────────────────────────────────────────────
create table if not exists stock_images (
  item_id         text        primary key,
  image_url       text        not null
);

-- ────────────────────────────────────────────────────────────
-- 5. Row Level Security — disable for service-role key usage
--    (Vercel Functions use the service role key, so RLS not needed)
-- ────────────────────────────────────────────────────────────
alter table machines     disable row level security;
alter table recipes      disable row level security;
alter table stocks       disable row level security;
alter table stock_images disable row level security;

-- ────────────────────────────────────────────────────────────
-- 6. Supabase Storage bucket for images
--    Run manually in Supabase dashboard > Storage, OR via this:
-- ────────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public)
-- values ('images', 'images', true)
-- on conflict do nothing;

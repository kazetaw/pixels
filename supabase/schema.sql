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
-- 2. items (one shared name + image for raw and processed products)
-- ────────────────────────────────────────────────────────────
create table if not exists items (
  item_id         text primary key,
  name            text not null,
  image_url       text,
  item_type       text not null default 'raw' check (item_type in ('raw', 'processed')),
  created_at      timestamptz default now()
);
create index if not exists items_name_idx on items (lower(name));

-- ────────────────────────────────────────────────────────────
-- 3. recipes (production details for a processed item)
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
-- 4. stocks  (quantity only; item metadata belongs to items)
-- ────────────────────────────────────────────────────────────
create table if not exists stocks (
  item_id         text        primary key references items(item_id),
  quantity        integer     not null default 0 check (quantity >= 0)
);

-- ────────────────────────────────────────────────────────────
-- Legacy only. New image writes go to items.image_url.
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
alter table items        disable row level security;
alter table recipes      disable row level security;
alter table stocks       disable row level security;
alter table stock_images disable row level security;

-- ────────────────────────────────────────────────────────────
-- 5. floor_timers (real-time factory floor timer)
-- A row is an independently managed production floor.  Time is
-- stored as timestamps/duration so every client derives the same
-- remaining time without writing once per second.
-- ────────────────────────────────────────────────────────────
create table if not exists floor_timers (
  floor_number                 integer primary key check (floor_number >= 1),
  profession                   text,
  machine_id                   uuid references machines(machine_id) on delete set null,
  recipe_id                    uuid references recipes(id) on delete set null,
  status                       text not null default 'idle'
                               check (status in ('idle', 'running')),
  start_time                   timestamptz,
  estimated_duration_seconds   integer not null default 0
                               check (estimated_duration_seconds >= 0),
  completed_at                 timestamptz,
  updated_at                   timestamptz not null default now()
);

alter table floor_timers disable row level security;
-- Safe to run again when upgrading an already-created table.
alter table floor_timers add column if not exists machine_id uuid references machines(machine_id) on delete set null;
alter table floor_timers add column if not exists recipe_id uuid references recipes(id) on delete set null;

-- ────────────────────────────────────────────────────────────
-- 6. shared_production_plans (one shared plan for all users)
-- ────────────────────────────────────────────────────────────
create table if not exists shared_production_plans (
  id text primary key default 'default' check (id = 'default'),
  event_days integer not null check (event_days between 1 and 365),
  event_hours integer not null check (event_hours between 0 and 23),
  event_minutes integer not null check (event_minutes between 0 and 59),
  floors jsonb not null,
  updated_at timestamptz not null default now()
);

alter table shared_production_plans disable row level security;

-- ────────────────────────────────────────────────────────────
-- 7. Budgets and stock purchases
-- A purchase is an auditable stock movement: one row records the money spent
-- and the database function below increments the matching stock item atomically.
-- Currency is intentionally not converted; THB and G are separate budgets.
-- ────────────────────────────────────────────────────────────
create table if not exists budgets (
  currency        text primary key check (currency in ('THB', 'G')),
  limit_amount    numeric(14, 2) not null check (limit_amount >= 0),
  updated_at      timestamptz not null default now()
);

create table if not exists stock_purchases (
  id              uuid primary key default gen_random_uuid(),
  item_id         text not null,
  quantity        integer not null check (quantity > 0),
  total_amount    numeric(14, 2) not null check (total_amount >= 0),
  currency        text not null check (currency in ('THB', 'G')),
  source          text,
  contributor     text,
  purchased_at    timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
alter table stock_purchases add column if not exists contributor text;

create index if not exists stock_purchases_purchased_at_idx
  on stock_purchases (purchased_at desc);

alter table budgets disable row level security;
alter table stock_purchases disable row level security;

-- Call this from the API instead of separately inserting a purchase and
-- updating stocks. It protects the budget and prevents partial writes.
create or replace function record_stock_purchase(
  p_item_id text,
  p_quantity integer,
  p_total_amount numeric,
  p_currency text,
  p_source text default null
)
returns stock_purchases
language plpgsql
security definer
as $$
declare
  v_budget numeric;
  v_spent numeric;
  v_purchase stock_purchases;
begin
  if p_item_id is null or btrim(p_item_id) = '' then
    raise exception 'item_id is required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'total_amount cannot be negative';
  end if;
  if p_currency not in ('THB', 'G') then
    raise exception 'currency must be THB or G';
  end if;

  -- Lock the budget row so two simultaneous purchases cannot overspend it.
  select limit_amount into v_budget from budgets where currency = p_currency for update;
  if v_budget is not null then
    select coalesce(sum(total_amount), 0) into v_spent
      from stock_purchases where currency = p_currency;
    if v_spent + p_total_amount > v_budget then
      raise exception 'Budget exceeded for %', p_currency;
    end if;
  end if;

  insert into stock_purchases (item_id, quantity, total_amount, currency, source)
  values (btrim(p_item_id), p_quantity, p_total_amount, p_currency, nullif(btrim(coalesce(p_source, '')), ''))
  returning * into v_purchase;

  insert into stocks (item_id, quantity)
  values (btrim(p_item_id), p_quantity)
  on conflict (item_id) do update set quantity = stocks.quantity + excluded.quantity;

  return v_purchase;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. Supabase Storage bucket for images
--    Run manually in Supabase dashboard > Storage, OR via this:
-- ────────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public)
-- values ('images', 'images', true)
-- on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- 6. budgets  (one row per currency, upserted)
-- ────────────────────────────────────────────────────────────
create table if not exists budgets (
  currency     text    primary key check (currency in ('THB','G')),
  limit_amount numeric not null default 0
);

-- ────────────────────────────────────────────────────────────
-- 7. stock_purchases  (immutable purchase log)
-- ────────────────────────────────────────────────────────────
create table if not exists stock_purchases (
  id           uuid        primary key default gen_random_uuid(),
  item_id      text        not null,
  quantity     integer     not null check (quantity > 0),
  total_amount numeric     not null default 0,
  currency     text        not null check (currency in ('THB','G')),
  source       text,
  contributor  text,
  purchased_at timestamptz not null default now()
);

create index if not exists stock_purchases_currency_idx
  on stock_purchases (currency);

-- ────────────────────────────────────────────────────────────
-- 8. floor_timers  (one row per factory floor)
-- ────────────────────────────────────────────────────────────
create table if not exists floor_timers (
  floor_number                integer     primary key check (floor_number >= 1),
  profession                  text,
  machine_id                  uuid        references machines(machine_id) on delete set null,
  recipe_id                   uuid        references recipes(id) on delete set null,
  status                      text        not null default 'idle'
                                          check (status in ('idle','running')),
  start_time                  timestamptz,
  estimated_duration_seconds  integer     not null default 0,
  completed_at                timestamptz
);

alter table budgets          disable row level security;
alter table stock_purchases  disable row level security;
alter table floor_timers     disable row level security;

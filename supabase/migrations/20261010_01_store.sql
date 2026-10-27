-- One row per store (support multiple stores in the future)
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,  -- store simple 4-digit pin as plain text for now
  created_at timestamptz not null default now()
);
alter table public.stores disable row level security;

-- Products in a store: references items catalog for name/image, but own price and stock
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id text not null references public.items(item_id),
  price numeric(14,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  unique (store_id, item_id)
);
alter table public.store_products disable row level security;

-- Restock log
create table if not exists public.store_restocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id text not null references public.items(item_id),
  qty integer not null check (qty > 0),
  note text not null default '',
  restocked_at timestamptz not null default now()
);
alter table public.store_restocks disable row level security;

-- Sales log
create table if not exists public.store_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  item_id text not null references public.items(item_id),
  qty integer not null check (qty > 0),
  price_per_unit numeric(14,2) not null check (price_per_unit >= 0),
  total numeric(14,2) generated always as (qty * price_per_unit) stored,
  note text not null default '',
  sold_at timestamptz not null default now()
);
alter table public.store_sales disable row level security;

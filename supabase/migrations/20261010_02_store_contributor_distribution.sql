-- Add contributor to restock log
alter table public.store_restocks add column if not exists contributor text not null default '';

-- Distribution log: paying back to contributors
create table if not exists public.store_distributions (
  id           uuid        primary key default gen_random_uuid(),
  store_id     uuid        not null references public.stores(id) on delete cascade,
  contributor  text        not null check (length(trim(contributor)) > 0),
  item_id      text        not null references public.items(item_id),
  qty          integer     not null check (qty > 0),
  note         text        not null default '',
  distributed_at timestamptz not null default now()
);
alter table public.store_distributions disable row level security;
create index if not exists store_distributions_store_idx on public.store_distributions(store_id);
create index if not exists store_distributions_contributor_idx on public.store_distributions(contributor);

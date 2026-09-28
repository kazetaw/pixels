-- Shared assignments do not change stock quantities or purchase history.
create table if not exists public.contributor_assignments (
  id uuid primary key default gen_random_uuid(),
  contributor text not null check (length(trim(contributor)) between 1 and 100),
  item_id text not null references public.items(item_id),
  target bigint not null check (target > 0 and target <= 9007199254740991),
  updated_at timestamptz not null default now(),
  unique (contributor, item_id)
);
alter table public.contributor_assignments enable row level security;
-- Access through the server API using its service role only.

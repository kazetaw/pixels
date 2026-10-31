create table if not exists public.contributor_returns (
  id           uuid        primary key default gen_random_uuid(),
  contributor  text        not null check (length(trim(contributor)) > 0),
  item_id      text        not null references public.items(item_id),
  qty          integer     not null check (qty > 0),
  note         text        not null default '',
  returned_at  timestamptz not null default now()
);
alter table public.contributor_returns disable row level security;
create index if not exists contributor_returns_contributor_idx on public.contributor_returns(contributor);
create index if not exists contributor_returns_item_idx on public.contributor_returns(item_id);

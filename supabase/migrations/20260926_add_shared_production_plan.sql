create table if not exists public.shared_production_plans (
  id text primary key default 'default' check (id = 'default'),
  event_days integer not null check (event_days between 1 and 365),
  event_hours integer not null check (event_hours between 0 and 23),
  event_minutes integer not null check (event_minutes between 0 and 59),
  floors jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_production_plans disable row level security;

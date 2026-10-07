-- Shared machine inventory and its twelve-slot floor layout.
create table if not exists public.machine_layout (
  id text primary key check (id = 'default'),
  data jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.machine_layout enable row level security;
-- Access uses the server's service-role client, as with assignment_settings.

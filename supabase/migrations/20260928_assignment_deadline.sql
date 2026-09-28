create table if not exists public.assignment_settings (
  id text primary key check (id = 'default'),
  deadline date not null
);
alter table public.assignment_settings enable row level security;

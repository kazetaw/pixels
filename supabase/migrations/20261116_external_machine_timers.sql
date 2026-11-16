-- Independent timer records; existing production floors are unchanged.
create table if not exists public.external_machine_timers (
  floor_number bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 1 and 120),
  profession text,
  machine_id text,
  recipe_id text,
  status text not null default 'idle' check (status in ('idle', 'running')),
  start_time timestamptz,
  estimated_duration_seconds integer not null default 0 check (estimated_duration_seconds >= 0),
  completed_at timestamptz
);
alter table public.external_machine_timers enable row level security;
notify pgrst, 'reload schema';

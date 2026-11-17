-- POC accounts are independent of existing shared and browser-local timers.
create table if not exists public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.external_sessions (
  token_hash text primary key,
  owner_id uuid not null references public.external_accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists external_sessions_owner on public.external_sessions(owner_id);
create table if not exists public.external_account_timers (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.external_accounts(id) on delete cascade,
  import_key text,
  data jsonb not null,
  unique(owner_id, import_key)
);
create index if not exists external_account_timers_owner on public.external_account_timers(owner_id);
create table if not exists public.external_auth_limits (
  bucket text primary key,
  attempts integer not null,
  resets_at timestamptz not null
);
alter table public.external_accounts enable row level security;
alter table public.external_sessions enable row level security;
alter table public.external_account_timers enable row level security;
alter table public.external_auth_limits enable row level security;
-- Atomic shared limiter, including across serverless instances.
create or replace function public.external_auth_attempt(p_bucket text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into external_auth_limits(bucket, attempts, resets_at)
  values(p_bucket, 1, now() + interval '15 minutes')
  on conflict (bucket) do update set
    attempts = case when external_auth_limits.resets_at <= now() then 1 else external_auth_limits.attempts + 1 end,
    resets_at = case when external_auth_limits.resets_at <= now() then now() + interval '15 minutes' else external_auth_limits.resets_at end
  returning attempts into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.external_auth_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.external_auth_attempt(text, integer) to service_role;
notify pgrst, 'reload schema';
create or replace function public.external_patch_timer(p_id bigint, p_owner uuid, p_patch jsonb)
returns setof public.external_account_timers language sql security definer set search_path = public as $$
  update external_account_timers set data = data || p_patch
  where id = p_id and owner_id = p_owner returning *;
$$;
revoke all on function public.external_patch_timer(bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.external_patch_timer(bigint, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';

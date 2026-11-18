-- Server-only Web Push subscriptions and a durable per-device delivery queue.
create table if not exists public.external_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.external_accounts(id) on delete cascade,
 session_hash text not null references public.external_sessions(token_hash) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists external_push_owner on public.external_push_subscriptions(owner_id);
create table if not exists public.external_push_deliveries (
 id bigint generated always as identity primary key,
 subscription_id uuid not null references public.external_push_subscriptions(id) on delete cascade,
 timer_id bigint not null references public.external_account_timers(id) on delete cascade,
 run_start text not null,
 duration integer not null,
 due_at timestamptz not null,
 next_attempt_at timestamptz not null,
 attempts integer not null default 0,
 lease_until timestamptz,
 sent_at timestamptz,
 unique(subscription_id,timer_id,run_start,duration)
);
create index if not exists external_push_due on public.external_push_deliveries(next_attempt_at) where sent_at is null;
alter table public.external_push_subscriptions enable row level security;
alter table public.external_push_deliveries enable row level security;
revoke all on public.external_push_subscriptions, public.external_push_deliveries from anon, authenticated;

create or replace function public.external_push_schedule_timer() returns trigger
language plpgsql security definer set search_path = public as $$
declare finish timestamptz;
begin
 if TG_OP = 'UPDATE' and (old.data->>'status',old.data->>'start_time',old.data->>'estimated_duration_seconds') is not distinct from
 (new.data->>'status',new.data->>'start_time',new.data->>'estimated_duration_seconds') then return new; end if;
 delete from external_push_deliveries where timer_id = new.id and sent_at is null;
 if new.data->>'status' <> 'running' or new.data->>'start_time' is null or coalesce((new.data->>'estimated_duration_seconds')::integer,0) <= 0 then return new; end if;
 finish := (new.data->>'start_time')::timestamptz + (new.data->>'estimated_duration_seconds')::integer * interval '1 second';
 -- Do not send a burst of historical notifications when importing old timers.
 if finish <= now() then return new; end if;
 insert into external_push_deliveries(subscription_id,timer_id,run_start,duration,due_at,next_attempt_at)
 select s.id,new.id,new.data->>'start_time',(new.data->>'estimated_duration_seconds')::integer,finish,finish
 from external_push_subscriptions s join external_sessions x on x.token_hash=s.session_hash
 where s.owner_id=new.owner_id and x.expires_at>now() on conflict do nothing;
 return new;
end; $$;
drop trigger if exists external_push_timer_changed on public.external_account_timers;
create trigger external_push_timer_changed after insert or update on public.external_account_timers for each row execute function public.external_push_schedule_timer();

create or replace function public.external_push_schedule_device() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 if TG_OP='UPDATE' and old.owner_id=new.owner_id then return new; end if;
 delete from external_push_deliveries where subscription_id=new.id;
 insert into external_push_deliveries(subscription_id,timer_id,run_start,duration,due_at,next_attempt_at)
 select new.id,t.id,t.data->>'start_time',(t.data->>'estimated_duration_seconds')::integer,
 (t.data->>'start_time')::timestamptz + (t.data->>'estimated_duration_seconds')::integer * interval '1 second',
 (t.data->>'start_time')::timestamptz + (t.data->>'estimated_duration_seconds')::integer * interval '1 second'
 from external_account_timers t where t.owner_id=new.owner_id and t.data->>'status'='running'
 and (t.data->>'estimated_duration_seconds')::integer>0 and t.data->>'start_time' is not null
 and (t.data->>'start_time')::timestamptz + (t.data->>'estimated_duration_seconds')::integer * interval '1 second'>now()
 on conflict do nothing;
 return new;
end; $$;
drop trigger if exists external_push_device_changed on public.external_push_subscriptions;
create trigger external_push_device_changed after insert or update on public.external_push_subscriptions for each row execute function public.external_push_schedule_device();

create or replace function public.external_push_claim() returns table (
 delivery_id bigint, subscription_id uuid, subscription jsonb, timer_id bigint,
 timer_data jsonb, due_at timestamptz, attempts integer, run_start text
) language plpgsql security definer set search_path = public as $$
begin
 -- Keep terminal records bounded; retries expire after the 15-minute collection window.
 delete from external_push_deliveries d where d.due_at < now()-interval '1 day';
 return query with picked as (
 select d.id from external_push_deliveries d
 join external_push_subscriptions s on s.id=d.subscription_id
 join external_sessions x on x.token_hash=s.session_hash and x.expires_at>now()
 join external_account_timers t on t.id=d.timer_id and t.owner_id=s.owner_id
 where d.sent_at is null and d.next_attempt_at<=now() and d.due_at>now()-interval '15 minutes'
 and (d.lease_until is null or d.lease_until<now()) and d.attempts<5
 and t.data->>'status'='running' and t.data->>'start_time'=d.run_start
 and (t.data->>'estimated_duration_seconds')::integer=d.duration
 order by d.due_at for update of d skip locked limit 50
 ), claimed as (
 update external_push_deliveries d set lease_until=now()+interval '2 minutes',attempts=d.attempts+1
 from picked p where d.id=p.id returning d.*
 ) select c.id,s.id,s.subscription,t.id,t.data,c.due_at,c.attempts,c.run_start
 from claimed c join external_push_subscriptions s on s.id=c.subscription_id join external_account_timers t on t.id=c.timer_id;
end; $$;
revoke all on function public.external_push_schedule_timer(), public.external_push_schedule_device(), public.external_push_claim() from public, anon, authenticated;
grant execute on function public.external_push_claim() to service_role;
notify pgrst, 'reload schema';

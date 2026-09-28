-- ============================================================
-- Factory Resource Calculator — Supabase Schema
-- Run this entire script in Supabase SQL Editor once.
-- ============================================================

-- ── Enable uuid extension (already on by default in Supabase) ──
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. machines
-- ────────────────────────────────────────────────────────────
create table if not exists machines (
  machine_id      uuid        primary key default gen_random_uuid(),
  machine_name    text        not null,
  floor_number    integer     not null check (floor_number >= 1),
  occupation      text        check (occupation in (
                                'วิศวะกร','หมอ','เชฟ','ไอดอล','เกษตร','ทุกอาชีพ'
                              )),
  image_url       text,           -- Supabase Storage public URL (nullable)
  created_at      timestamptz default now()
);

-- unique name (case-insensitive, NFKC-normalised handled in app layer)
create unique index if not exists machines_name_unique
  on machines (lower(machine_name));

-- ────────────────────────────────────────────────────────────
-- 2. items (one shared name + image for raw and processed products)
-- ────────────────────────────────────────────────────────────
create table if not exists items (
  item_id         text primary key,
  name            text not null,
  image_url       text,
  item_type       text not null default 'raw' check (item_type in ('raw', 'processed')),
  created_at      timestamptz default now()
);
create index if not exists items_name_idx on items (lower(name));

-- ────────────────────────────────────────────────────────────
-- 3. recipes (production details for a processed item)
-- ────────────────────────────────────────────────────────────
create table if not exists recipes (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  machine_id      uuid        references machines(machine_id) on delete set null,
  time_per_unit   text,           -- "HH:MM:SS" string, nullable
  ingredients     jsonb       not null default '{}',  -- { item_id: quantity }
  image_url       text,           -- Supabase Storage public URL (nullable)
  created_at      timestamptz default now()
);

create unique index if not exists recipes_name_unique
  on recipes (lower(name));

-- ────────────────────────────────────────────────────────────
-- 4. stocks  (quantity only; item metadata belongs to items)
-- ────────────────────────────────────────────────────────────
create table if not exists stocks (
  item_id         text        primary key references items(item_id),
  quantity        integer     not null default 0 check (quantity >= 0)
);

-- ────────────────────────────────────────────────────────────
-- Legacy only. New image writes go to items.image_url.
-- ────────────────────────────────────────────────────────────
create table if not exists stock_images (
  item_id         text        primary key,
  image_url       text        not null
);

-- ────────────────────────────────────────────────────────────
-- 5. Row Level Security — disable for service-role key usage
--    (Vercel Functions use the service role key, so RLS not needed)
-- ────────────────────────────────────────────────────────────
alter table machines     disable row level security;
alter table items        disable row level security;
alter table recipes      disable row level security;
alter table stocks       disable row level security;
alter table stock_images disable row level security;

-- ────────────────────────────────────────────────────────────
-- 5. floor_timers (real-time factory floor timer)
-- A row is an independently managed production floor.  Time is
-- stored as timestamps/duration so every client derives the same
-- remaining time without writing once per second.
-- ────────────────────────────────────────────────────────────
create table if not exists floor_timers (
  floor_number                 integer primary key check (floor_number >= 1),
  profession                   text,
  machine_id                   uuid references machines(machine_id) on delete set null,
  recipe_id                    uuid references recipes(id) on delete set null,
  status                       text not null default 'idle'
                               check (status in ('idle', 'running')),
  start_time                   timestamptz,
  estimated_duration_seconds   integer not null default 0
                               check (estimated_duration_seconds >= 0),
  completed_at                 timestamptz,
  updated_at                   timestamptz not null default now()
);

alter table floor_timers disable row level security;
-- Safe to run again when upgrading an already-created table.
alter table floor_timers add column if not exists machine_id uuid references machines(machine_id) on delete set null;
alter table floor_timers add column if not exists recipe_id uuid references recipes(id) on delete set null;

-- ────────────────────────────────────────────────────────────
-- 6. shared_production_plans (one shared plan for all users)
-- ────────────────────────────────────────────────────────────
create table if not exists shared_production_plans (
  id text primary key default 'default' check (id = 'default'),
  event_days integer not null check (event_days between 1 and 365),
  event_hours integer not null check (event_hours between 0 and 23),
  event_minutes integer not null check (event_minutes between 0 and 59),
  floors jsonb not null,
  updated_at timestamptz not null default now()
);

alter table shared_production_plans disable row level security;

-- ────────────────────────────────────────────────────────────
-- 7. Budgets and stock purchases
-- A purchase is an auditable stock movement: one row records the money spent
-- and the database function below increments the matching stock item atomically.
-- Currency is intentionally not converted; THB and G are separate budgets.
-- ────────────────────────────────────────────────────────────
create table if not exists budgets (
  currency        text primary key check (currency in ('THB', 'G')),
  limit_amount    numeric(14, 2) not null check (limit_amount >= 0),
  updated_at      timestamptz not null default now()
);

create table if not exists stock_purchases (
  id              uuid primary key default gen_random_uuid(),
  item_id         text not null,
  quantity        integer not null check (quantity > 0),
  total_amount    numeric(14, 2) not null check (total_amount >= 0),
  currency        text not null check (currency in ('THB', 'G')),
  source          text,
  contributor     text,
  purchased_at    timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
alter table stock_purchases add column if not exists contributor text;

create index if not exists stock_purchases_purchased_at_idx
  on stock_purchases (purchased_at desc);

alter table budgets disable row level security;
alter table stock_purchases disable row level security;

-- Call this from the API instead of separately inserting a purchase and
-- updating stocks. It prevents partial writes; budgets are tracking only.
create or replace function record_stock_purchase(
  p_item_id text,
  p_quantity integer,
  p_total_amount numeric,
  p_currency text,
  p_source text default null,
  p_contributor text default null
)
returns stock_purchases
language plpgsql
security definer
as $$
declare
  v_purchase stock_purchases;
begin
  if p_item_id is null or btrim(p_item_id) = '' then
    raise exception 'item_id is required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'total_amount cannot be negative';
  end if;
  if p_currency not in ('THB', 'G') then
    raise exception 'currency must be THB or G';
  end if;

  insert into stock_purchases (item_id, quantity, total_amount, currency, source, contributor)
  values (
    btrim(p_item_id), p_quantity, p_total_amount, p_currency,
    nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_contributor, '')), '')
  )
  returning * into v_purchase;

  insert into stocks (item_id, quantity)
  values (btrim(p_item_id), p_quantity)
  on conflict (item_id) do update set quantity = stocks.quantity + excluded.quantity;

  return v_purchase;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. Supabase Storage bucket for images
--    Run manually in Supabase dashboard > Storage, OR via this:
-- ────────────────────────────────────────────────────────────
-- insert into storage.buckets (id, name, public)
-- values ('images', 'images', true)
-- on conflict do nothing;

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

create table if not exists public.assignment_settings (
  id text primary key check (id = 'default'),
  deadline date not null
);
alter table public.assignment_settings enable row level security;

create table if not exists public.withdrawals (
 id uuid primary key,
 character_id text not null,
 note text not null default '',
 status text not null default 'pending' check (status in ('pending','sent','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.withdrawal_lines (
 withdrawal_id uuid not null references public.withdrawals(id),
 item_id text not null references public.items(item_id),
 quantity integer not null check (quantity > 0),
 primary key (withdrawal_id,item_id)
);
alter table public.withdrawals enable row level security;
alter table public.withdrawal_lines enable row level security;
create or replace function public.create_withdrawal(p_id uuid,p_character text,p_note text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare r record; available bigint; reserved bigint;
begin
 -- Serialize reservation and status transitions, then lock stocks against other writers.
 perform pg_advisory_xact_lock(726291);
 if exists(select 1 from withdrawals where id=p_id) then return p_id; end if;
 if p_character !~ '^[0-9]{1,30}$' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Invalid request'; end if;
 for r in select item_id,sum(quantity)::bigint quantity from jsonb_to_recordset(p_lines) as x(item_id text,quantity integer) group by item_id order by item_id loop
   if r.quantity is null or r.quantity <= 0 or r.quantity > 2147483647 then raise exception 'Invalid quantity'; end if;
   select quantity into available from stocks where item_id=r.item_id for update;
   if not found then raise exception 'ไม่พบสต็อกสินค้า'; end if;
   select coalesce(sum(l.quantity),0) into reserved from withdrawal_lines l join withdrawals w on w.id=l.withdrawal_id where w.status='pending' and l.item_id=r.item_id;
   if available-reserved < r.quantity then raise exception 'สินค้าเหลือไม่พอให้จอง กรุณาโหลดใหม่'; end if;
 end loop;
 insert into withdrawals(id,character_id,note) values(p_id,p_character,coalesce(p_note,''));
 insert into withdrawal_lines select p_id,item_id,sum(quantity)::integer from jsonb_to_recordset(p_lines) as x(item_id text,quantity integer) group by item_id;
 return p_id;
end $$;
create or replace function public.finish_withdrawal(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare current_status text; r record;
begin
 perform pg_advisory_xact_lock(726291);
 if p_status not in ('sent','cancelled') then raise exception 'Invalid status'; end if;
 select status into current_status from withdrawals where id=p_id for update;
 if not found then raise exception 'ไม่พบใบเบิก'; end if;
 if current_status=p_status then return; end if;
 if current_status<>'pending' then raise exception 'ใบเบิกนี้ดำเนินการแล้ว'; end if;
 if p_status='sent' then
   for r in select * from withdrawal_lines where withdrawal_id=p_id order by item_id loop
     update stocks set quantity=quantity-r.quantity where item_id=r.item_id and quantity>=r.quantity;
     if not found then raise exception 'สต็อกไม่พอส่ง'; end if;
   end loop;
 end if;
 update withdrawals set status=p_status,updated_at=now() where id=p_id;
end $$;
revoke all on function public.create_withdrawal(uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.finish_withdrawal(uuid,text) from public,anon,authenticated;
grant execute on function public.create_withdrawal(uuid,text,text,jsonb) to service_role;
grant execute on function public.finish_withdrawal(uuid,text) to service_role;

create table if not exists public.withdrawal_catalog (
 item_id text primary key references public.items(item_id),
 enabled boolean not null default true
);
alter table public.withdrawal_catalog enable row level security;
insert into public.withdrawal_catalog(item_id)
select item_id from public.items where name in ('เห็ดพิษ','นมแกะ','เนย','ไส้เดือนดิน','ขี้ไก่','ไข่หนอนผีเสื้อ','ละอองผีเสื้อ','ดิน','โซดา','ก้อนโคลน','ปลาแบสเล็ก','เมล็ดพืชพันธุ์ดี')
on conflict(item_id) do nothing;

alter table public.withdrawals add column if not exists requester_name text not null default '';
alter table public.withdrawals add column if not exists recipient_name text not null default '';
drop function if exists public.create_withdrawal(uuid,text,text,jsonb);
create or replace function public.create_withdrawal(p_id uuid,p_character text,p_note text,p_lines jsonb,p_requester text,p_recipient text)
returns uuid language plpgsql security definer set search_path=public as $$
declare r record; available bigint; reserved bigint;
begin
 -- Serialize reservation and status transitions, then lock stocks against other writers.
 perform pg_advisory_xact_lock(726291);
 if exists(select 1 from withdrawals where id=p_id) then return p_id; end if;
 if p_character !~ '^[0-9]{1,30}$' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Invalid request'; end if;
 for r in select item_id,sum(quantity)::bigint quantity from jsonb_to_recordset(p_lines) as x(item_id text,quantity integer) group by item_id order by item_id loop
   if r.quantity is null or r.quantity <= 0 or r.quantity > 2147483647 then raise exception 'Invalid quantity'; end if;
   select quantity into available from stocks where item_id=r.item_id for update;
   if not found then raise exception 'ไม่พบสต็อกสินค้า'; end if;
   select coalesce(sum(l.quantity),0) into reserved from withdrawal_lines l join withdrawals w on w.id=l.withdrawal_id where w.status='pending' and l.item_id=r.item_id;
   if available-reserved < r.quantity then raise exception 'สินค้าเหลือไม่พอให้จอง กรุณาโหลดใหม่'; end if;
 end loop;
 if length(trim(coalesce(p_requester,''))) not between 1 and 100 or length(trim(coalesce(p_recipient,''))) not between 1 and 100 then raise exception 'กรุณาระบุผู้เบิกและชื่อตัวละครผู้รับ'; end if;
 insert into withdrawals(id,character_id,note,requester_name,recipient_name) values(p_id,p_character,coalesce(p_note,''),trim(p_requester),trim(p_recipient));
 insert into withdrawal_lines select p_id,item_id,sum(quantity)::integer from jsonb_to_recordset(p_lines) as x(item_id text,quantity integer) group by item_id;
 return p_id;
end $$;

revoke all on function public.create_withdrawal(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_withdrawal(uuid,text,text,jsonb,text,text) to service_role;

-- Return one page of receipts; reservations always include ALL pending receipts.
create index if not exists withdrawals_status_created_idx on public.withdrawals(status,created_at desc);
create index if not exists withdrawal_lines_item_idx on public.withdrawal_lines(item_id);
create or replace function public.withdrawal_dashboard(p_page integer default 1,p_query text default '',p_status text default '',p_person text default '',p_item text default '')
returns jsonb language sql stable security definer set search_path=public as $$
with filtered as (
 select w.* from withdrawals w
 where (p_status='' or w.status=p_status) and (p_person='' or w.requester_name=p_person)
 and (p_item='' or exists(select 1 from withdrawal_lines l where l.withdrawal_id=w.id and l.item_id=p_item))
 and (p_query='' or position(lower(p_query) in lower(w.id::text||' '||w.character_id||' '||w.requester_name||' '||w.recipient_name))>0
 or exists(select 1 from withdrawal_lines l join items i on i.item_id=l.item_id where l.withdrawal_id=w.id and position(lower(p_query) in lower(i.name))>0))
), paged as (
 select * from filtered order by (status='pending') desc,created_at desc,id limit 10 offset ((greatest(1,p_page)-1)::bigint*10)
), reserved as (
 select l.item_id,sum(l.quantity) qty from withdrawal_lines l join withdrawals w on w.id=l.withdrawal_id where w.status='pending' group by l.item_id
)
select jsonb_build_object(
 'total',(select count(*) from withdrawals),
 'matched',(select count(*) from filtered),
 'tickets',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('withdrawal_lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.item_id) from withdrawal_lines l where l.withdrawal_id=p.id),'[]'::jsonb)) order by (p.status='pending') desc,p.created_at desc,p.id) from paged p),'[]'::jsonb),
 'availability',coalesce((select jsonb_object_agg(c.item_id,greatest(0,coalesce(s.quantity,0)-coalesce(r.qty,0))) from withdrawal_catalog c left join stocks s on s.item_id=c.item_id left join reserved r on r.item_id=c.item_id where c.enabled),'{}'::jsonb),
 'people',coalesce((select jsonb_agg(x.requester_name order by x.requester_name) from (select distinct requester_name from withdrawals where requester_name<>'') x),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(x.item_id order by x.item_id) from (select distinct item_id from withdrawal_lines) x),'[]'::jsonb)
);
$$;
revoke all on function public.withdrawal_dashboard(integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.withdrawal_dashboard(integer,text,text,text,text) to service_role;

-- Normalize every item reference to a UUID-shaped canonical item_id.
-- Keep this mapping for auditability and for any external import still using
-- a former Thai-name key.
create table if not exists public.item_id_migrations (
  legacy_item_id text primary key,
  item_id text not null unique,
  migrated_at timestamptz not null default now()
);

-- Discard mappings created by a partial older run. This table is rebuilt from
-- the current catalog below; no item, stock, recipe, or purchase data is lost.
truncate table public.item_id_migrations;

alter table public.items add column if not exists item_type text not null default 'raw'
  check (item_type in ('raw', 'processed'));

insert into public.item_id_migrations (legacy_item_id, item_id)
select i.item_id,
  case when i.item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then i.item_id else gen_random_uuid()::text end
from public.items i
on conflict (legacy_item_id) do nothing;

-- Stock quantities can collide when a legacy material name maps to a processed item.
create temporary table normalized_stocks as
select coalesce(m.item_id, s.item_id) as item_id, sum(s.quantity)::integer as quantity
from public.stocks s left join public.item_id_migrations m on m.legacy_item_id = s.item_id
group by coalesce(m.item_id, s.item_id);

alter table public.stocks drop constraint if exists stocks_item_id_fkey;
delete from public.stocks;
insert into public.stocks (item_id, quantity) select item_id, quantity from normalized_stocks;

update public.stock_purchases p set item_id = m.item_id
from public.item_id_migrations m where m.legacy_item_id = p.item_id;

-- Rewrite every BOM ingredient key and add quantities when two old keys merge.
update public.recipes r set ingredients = coalesce((
  select jsonb_object_agg(item_id, quantity) from (
    select coalesce(m.item_id, entry.key) as item_id,
      sum((entry.value #>> '{}')::numeric) as quantity
    from jsonb_each(r.ingredients) entry
    left join public.item_id_migrations m on m.legacy_item_id = entry.key
    group by coalesce(m.item_id, entry.key)
  ) grouped
), '{}'::jsonb);

create temporary table normalized_items as
select m.item_id, min(i.name) as name, max(i.image_url) as image_url,
  case when bool_or(r.id is not null) then 'processed' else 'raw' end as item_type
from public.items i join public.item_id_migrations m on m.legacy_item_id = i.item_id
left join public.recipes r on r.id::text = m.item_id
group by m.item_id;

delete from public.items;
insert into public.items (item_id, name, image_url, item_type)
select item_id, name, image_url, item_type from normalized_items;

update public.items i set name = r.name, image_url = coalesce(r.image_url, i.image_url), item_type = 'processed'
from public.recipes r where i.item_id = r.id::text;

-- A prior partial run may leave the foreign key with a generated name.
-- Remove any existing stock foreign key before creating the canonical one.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.stocks'::regclass and contype = 'f'
  loop
    execute format('alter table public.stocks drop constraint %I', constraint_name);
  end loop;
  alter table public.stocks add constraint stocks_item_id_fkey
    foreign key (item_id) references public.items(item_id) on delete restrict;
end $$;

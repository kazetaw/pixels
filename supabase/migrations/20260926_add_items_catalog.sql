-- One catalog row owns each item's display name and image.
create table if not exists public.items (
  item_id text primary key,
  name text not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- Legacy data can contain a raw-material key with the same display name as a
-- processed product. Keep identity on item_id while the application resolves
-- those aliases; do not reject the migration for an existing duplicate name.
drop index if exists public.items_name_unique;
create index if not exists items_name_idx on public.items (lower(name));
alter table public.items disable row level security;

-- Processed products keep their existing recipe UUID as the shared item ID.
insert into public.items (item_id, name, image_url)
select id::text, name, image_url from public.recipes
on conflict (item_id) do update set name = excluded.name, image_url = coalesce(excluded.image_url, items.image_url);

-- Raw materials already stored in stock or used by a recipe become catalog items too.
insert into public.items (item_id, name, image_url)
select source.item_id, source.item_id, stock_images.image_url
from (
  select item_id from public.stocks
  union
  select jsonb_object_keys(ingredients) from public.recipes
) source
left join public.stock_images on stock_images.item_id = source.item_id
on conflict (item_id) do update set image_url = coalesce(items.image_url, excluded.image_url);

-- From now on every stock key must be an item catalog key.
alter table public.stocks
  add constraint stocks_item_id_fkey foreign key (item_id) references public.items(item_id) on delete restrict;

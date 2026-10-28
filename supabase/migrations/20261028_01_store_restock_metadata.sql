-- Preserve unknown authors on historical entries; new requests provide the name.
alter table public.store_restocks
  add column if not exists entered_by text,
  add column if not exists tags text[] not null default '{}';
-- restocked_at already records the database timestamp for each restock.

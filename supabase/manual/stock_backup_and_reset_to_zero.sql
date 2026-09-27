-- สำรองยอดสต็อกปัจจุบัน แล้วตั้งยอดทุกสินค้าเป็น 0
--
-- รันไฟล์นี้ครั้งเดียวใน Supabase SQL Editor ก่อนเริ่มกรอกยอดใหม่จากงบประมาณ
-- ผลลัพธ์แถวสุดท้ายจะมี restore_backup_id เก็บค่านี้ไว้สำหรับคืนยอดเดิมภายหลัง
-- ไม่แตะ items, รูป, recipes, เครื่องจักร, budgets หรือ stock_purchases

begin;

create table if not exists public.stock_quantity_backup_runs (
  backup_id uuid primary key,
  created_at timestamptz not null default now(),
  description text not null
);

create table if not exists public.stock_quantity_backup_items (
  backup_id uuid not null references public.stock_quantity_backup_runs(backup_id) on delete cascade,
  item_id text not null references public.items(item_id) on delete restrict,
  quantity integer not null check (quantity >= 0),
  primary key (backup_id, item_id)
);

create temporary table stock_reset_run (
  backup_id uuid not null
) on commit drop;

insert into stock_reset_run (backup_id)
values (gen_random_uuid());

insert into public.stock_quantity_backup_runs (backup_id, description)
select backup_id, 'ยอดก่อนรีเซ็ตสต็อกเป็น 0'
from stock_reset_run;

insert into public.stock_quantity_backup_items (backup_id, item_id, quantity)
select run.backup_id, stock.item_id, stock.quantity
from stock_reset_run run
cross join public.stocks stock;

update public.stocks
set quantity = 0
where quantity <> 0;

select
  run.backup_id as restore_backup_id,
  count(backup.item_id) as items_backed_up,
  coalesce(sum(backup.quantity), 0) as quantity_before_reset
from stock_reset_run run
left join public.stock_quantity_backup_items backup on backup.backup_id = run.backup_id
group by run.backup_id;

commit;

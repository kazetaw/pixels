-- สร้างยอดสต็อกใหม่จากรายการซื้อที่บันทึกหลังรีเซ็ต
--
-- ใช้เมื่อรายการซื้อแสดงในงบประมาณแล้ว แต่ยอดในคลังยังเป็น 0
-- 1. แทน YOUR_BACKUP_ID ด้วย restore_backup_id ที่ได้จาก stock_backup_and_reset_to_zero.sql
-- 2. รันใน Supabase SQL Editor
--
-- สคริปต์จะตั้งยอด stocks ใหม่จากผลรวม stock_purchases ตั้งแต่เวลาที่รีเซ็ต
-- ไม่ลบประวัติรายการซื้อ และสามารถรันซ้ำได้โดยไม่บวกยอดซ้ำ

begin;

create temporary table stock_rebuild_run (
  backup_id uuid not null,
  reset_at timestamptz not null
) on commit drop;

insert into stock_rebuild_run (backup_id, reset_at)
select backup_id, created_at
from public.stock_quantity_backup_runs
where backup_id = 'YOUR_BACKUP_ID'::uuid;

do $$
begin
  if not exists (select 1 from stock_rebuild_run) then
    raise exception 'ไม่พบชุดสำรองนี้ กรุณาตรวจ backup_id อีกครั้ง';
  end if;
end $$;

update public.stocks set quantity = 0 where quantity <> 0;

insert into public.stocks (item_id, quantity)
select purchase.item_id, sum(purchase.quantity)::integer
from public.stock_purchases purchase
cross join stock_rebuild_run run
where purchase.purchased_at >= run.reset_at
group by purchase.item_id
on conflict (item_id) do update set quantity = excluded.quantity;

select
  run.reset_at,
  count(purchase.id) as purchases_rebuilt,
  coalesce(sum(purchase.quantity), 0) as stock_rebuilt
from stock_rebuild_run run
left join public.stock_purchases purchase on purchase.purchased_at >= run.reset_at
group by run.reset_at;

commit;

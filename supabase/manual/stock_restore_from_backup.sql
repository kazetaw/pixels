-- คืนยอดสต็อกจากชุดสำรอง
--
-- 1. เปิดตาราง stock_quantity_backup_runs ใน Supabase แล้วคัดลอก backup_id ที่ต้องการ
-- 2. วางค่านั้นแทน YOUR_BACKUP_ID ด้านล่าง
-- 3. รันไฟล์นี้ใน Supabase SQL Editor
--
-- คำเตือน: การคืนยอดจะเขียนทับยอดของสินค้าที่อยู่ในชุดสำรองนั้น
-- จึงควรรันก่อนบันทึกรายการซื้อใหม่ หรือใช้เมื่อแน่ใจว่าต้องการย้อนกลับ

begin;

create temporary table stock_restore_run (
  backup_id uuid not null
) on commit drop;

insert into stock_restore_run (backup_id)
values ('YOUR_BACKUP_ID'::uuid);

do $$
begin
  if not exists (
    select 1
    from public.stock_quantity_backup_items backup
    join stock_restore_run run on run.backup_id = backup.backup_id
  ) then
    raise exception 'ไม่พบชุดสำรองนี้ กรุณาตรวจ backup_id อีกครั้ง';
  end if;
end $$;

insert into public.stocks (item_id, quantity)
select backup.item_id, backup.quantity
from public.stock_quantity_backup_items backup
join stock_restore_run run on run.backup_id = backup.backup_id
on conflict (item_id) do update set quantity = excluded.quantity;

select
  run.backup_id as restored_backup_id,
  count(backup.item_id) as restored_items,
  coalesce(sum(backup.quantity), 0) as restored_quantity
from stock_restore_run run
join public.stock_quantity_backup_items backup on backup.backup_id = run.backup_id
group by run.backup_id;

commit;

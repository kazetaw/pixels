-- กู้ยอดสต็อกเฉพาะรายการซื้อของวันที่ 27 ก.ย. 2569 ก่อนรีเซ็ต 18:39
--
-- ชุดรีเซ็ต: 5b790201-e5ab-482f-a4d5-8c7bec527ebb
-- ช่วงที่กู้: 27 ก.ย. 2569 00:00 (เวลาไทย) จนถึงก่อนเวลารีเซ็ต
--
-- ไม่สร้าง stock_purchases ใหม่ และรันซ้ำได้อย่างปลอดภัย:
-- รายการซื้อหนึ่งรายการจะถูกนำกลับเข้าสต็อกได้เพียงครั้งเดียว

begin;

create table if not exists public.stock_purchase_stock_recoveries (
  purchase_id uuid primary key references public.stock_purchases(id) on delete cascade,
  recovered_at timestamptz not null default now(),
  recovery_note text not null
);

lock table public.stocks, public.stock_purchases, public.stock_purchase_stock_recoveries
  in share row exclusive mode;

create temporary table purchases_to_recover (
  purchase_id uuid primary key,
  item_id text not null,
  quantity integer not null
) on commit drop;

insert into purchases_to_recover (purchase_id, item_id, quantity)
select purchase.id, purchase.item_id, purchase.quantity
from public.stock_purchases purchase
where purchase.purchased_at >= '2026-09-27 00:00:00+07'::timestamptz
  and purchase.purchased_at < (
    select created_at
    from public.stock_quantity_backup_runs
    where backup_id = '5b790201-e5ab-482f-a4d5-8c7bec527ebb'::uuid
  )
  and not exists (
    select 1
    from public.stock_purchase_stock_recoveries recovery
    where recovery.purchase_id = purchase.id
  );

insert into public.stocks (item_id, quantity)
select item_id, sum(quantity)::integer
from purchases_to_recover
group by item_id
on conflict (item_id) do update
set quantity = public.stocks.quantity + excluded.quantity;

insert into public.stock_purchase_stock_recoveries (purchase_id, recovery_note)
select purchase_id, 'กู้ยอดรายการซื้อก่อนรีเซ็ต 27 ก.ย. 2569'
from purchases_to_recover;

select
  count(*) as recovered_purchases,
  coalesce(sum(quantity), 0) as recovered_quantity
from purchases_to_recover;

commit;

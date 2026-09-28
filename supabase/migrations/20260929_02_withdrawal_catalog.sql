
create table if not exists public.withdrawal_catalog (
 item_id text primary key references public.items(item_id),
 enabled boolean not null default true
);
alter table public.withdrawal_catalog enable row level security;
insert into public.withdrawal_catalog(item_id)
select item_id from public.items where name in ('เห็ดพิษ','นมแกะ','เนย','ไส้เดือนดิน','ขี้ไก่','ไข่หนอนผีเสื้อ','ละอองผีเสื้อ','ดิน','โซดา','ก้อนโคลน','ปลาแบสเล็ก','เมล็ดพืชพันธุ์ดี')
on conflict(item_id) do nothing;

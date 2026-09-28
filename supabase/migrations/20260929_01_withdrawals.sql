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

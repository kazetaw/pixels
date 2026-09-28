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

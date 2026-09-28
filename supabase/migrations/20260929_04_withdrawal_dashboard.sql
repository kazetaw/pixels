-- Return one page of receipts; reservations always include ALL pending receipts.
create index if not exists withdrawals_status_created_idx on public.withdrawals(status,created_at desc);
create index if not exists withdrawal_lines_item_idx on public.withdrawal_lines(item_id);
create or replace function public.withdrawal_dashboard(p_page integer default 1,p_query text default '',p_status text default '',p_person text default '',p_item text default '')
returns jsonb language sql stable security definer set search_path=public as $$
with filtered as (
 select w.* from withdrawals w
 where (p_status='' or w.status=p_status) and (p_person='' or w.requester_name=p_person)
 and (p_item='' or exists(select 1 from withdrawal_lines l where l.withdrawal_id=w.id and l.item_id=p_item))
 and (p_query='' or position(lower(p_query) in lower(w.id::text||' '||w.character_id||' '||w.requester_name||' '||w.recipient_name))>0
 or exists(select 1 from withdrawal_lines l join items i on i.item_id=l.item_id where l.withdrawal_id=w.id and position(lower(p_query) in lower(i.name))>0))
), paged as (
 select * from filtered order by (status='pending') desc,created_at desc,id limit 10 offset ((greatest(1,p_page)-1)::bigint*10)
), reserved as (
 select l.item_id,sum(l.quantity) qty from withdrawal_lines l join withdrawals w on w.id=l.withdrawal_id where w.status='pending' group by l.item_id
)
select jsonb_build_object(
 'total',(select count(*) from withdrawals),
 'matched',(select count(*) from filtered),
 'tickets',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('withdrawal_lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.item_id) from withdrawal_lines l where l.withdrawal_id=p.id),'[]'::jsonb)) order by (p.status='pending') desc,p.created_at desc,p.id) from paged p),'[]'::jsonb),
 'availability',coalesce((select jsonb_object_agg(c.item_id,greatest(0,coalesce(s.quantity,0)-coalesce(r.qty,0))) from withdrawal_catalog c left join stocks s on s.item_id=c.item_id left join reserved r on r.item_id=c.item_id where c.enabled),'{}'::jsonb),
 'people',coalesce((select jsonb_agg(x.requester_name order by x.requester_name) from (select distinct requester_name from withdrawals where requester_name<>'') x),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(x.item_id order by x.item_id) from (select distinct item_id from withdrawal_lines) x),'[]'::jsonb)
);
$$;
revoke all on function public.withdrawal_dashboard(integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.withdrawal_dashboard(integer,text,text,text,text) to service_role;

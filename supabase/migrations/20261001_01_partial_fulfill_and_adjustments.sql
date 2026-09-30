-- ─────────────────────────────────────────────────────────────────────────────
-- stock_adjustments: manual stock deduction/addition log by admin
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.stock_adjustments (
  id          uuid        primary key default gen_random_uuid(),
  item_id     text        not null references public.items(item_id),
  delta       integer     not null,   -- negative = deduct, positive = add
  reason      text        not null default '',
  created_at  timestamptz not null default now()
);
alter table public.stock_adjustments disable row level security;
create index if not exists stock_adjustments_item_idx on public.stock_adjustments(item_id);
create index if not exists stock_adjustments_created_idx on public.stock_adjustments(created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- add admin_note column to withdrawals for partial fulfillment notes
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.withdrawals add column if not exists admin_note text not null default '';

-- ─────────────────────────────────────────────────────────────────────────────
-- partial_fulfill_withdrawal:
--   Fulfills a pending withdrawal with potentially reduced quantities.
--   actual_lines: [{"item_id": "...", "quantity": N}, ...]
--   Deducts actual quantities from stock, marks withdrawal as sent.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.partial_fulfill_withdrawal(
  p_id          uuid,
  p_actual_lines jsonb,   -- [{"item_id": text, "quantity": int}]
  p_admin_note  text default ''
)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  perform pg_advisory_xact_lock(726291);

  if not exists (select 1 from withdrawals where id = p_id and status = 'pending') then
    raise exception 'ไม่พบใบเบิกที่รอส่ง';
  end if;

  if p_actual_lines is null or jsonb_typeof(p_actual_lines) <> 'array' or jsonb_array_length(p_actual_lines) = 0 then
    raise exception 'actual_lines ต้องเป็น array ที่มีอย่างน้อย 1 รายการ';
  end if;

  -- Deduct stock for each actual line (skip if quantity = 0)
  for r in
    select item_id, sum(quantity)::integer as qty
    from jsonb_to_recordset(p_actual_lines) as x(item_id text, quantity integer)
    where quantity > 0
    group by item_id
  loop
    update stocks set quantity = greatest(0, quantity - r.qty) where item_id = r.item_id;
    if not found then
      raise exception 'ไม่พบสต็อกสินค้า %', r.item_id;
    end if;
  end loop;

  -- Mark as sent with admin note
  update withdrawals
  set status = 'sent', updated_at = now(), admin_note = coalesce(p_admin_note, '')
  where id = p_id;
end;
$$;

revoke all on function public.partial_fulfill_withdrawal(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.partial_fulfill_withdrawal(uuid, jsonb, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- apply_stock_adjustment: deduct/add stock and log it
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_stock_adjustment(
  p_item_id  text,
  p_delta    integer,
  p_reason   text default ''
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_delta = 0 then raise exception 'delta ต้องไม่เป็น 0'; end if;

  update stocks
  set quantity = greatest(0, quantity + p_delta)
  where item_id = p_item_id;

  if not found then raise exception 'ไม่พบสต็อกสินค้า'; end if;

  insert into stock_adjustments(item_id, delta, reason)
  values (p_item_id, p_delta, coalesce(p_reason, ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_stock_adjustment(text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_stock_adjustment(text, integer, text) to service_role;

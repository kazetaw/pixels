-- Edit a purchase and apply only its stock delta, in one transaction.
create or replace function public.edit_stock_purchase(p_id uuid, p_expected jsonb, p_changes jsonb)
returns public.stock_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row public.stock_purchases;
  new_row public.stock_purchases;
  new_item text := p_changes->>'item_id';
  new_qty integer := (p_changes->>'quantity')::integer;
  new_total numeric := (p_changes->>'total_amount')::numeric;
  new_currency text := p_changes->>'currency';
  available integer;
begin
  -- These short-lived locks also serialize existing stock writes while the
  -- purchase and stock delta are being changed. Any error rolls both back.
  lock table public.budgets, public.stock_purchases, public.stocks in share row exclusive mode;
  select * into old_row from public.stock_purchases where id = p_id for update;
  if not found then raise exception 'ไม่พบรายการซื้อ'; end if;
  if old_row.item_id is distinct from (p_expected->>'item_id')
    or old_row.quantity is distinct from (p_expected->>'quantity')::integer
    or old_row.total_amount is distinct from (p_expected->>'total_amount')::numeric
    or old_row.currency is distinct from (p_expected->>'currency')
    or old_row.source is distinct from (p_expected->>'source')
    or old_row.contributor is distinct from (p_expected->>'contributor')
    or old_row.purchased_at is distinct from (p_expected->>'purchased_at')::timestamptz then
    raise exception 'รายการนี้ถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่';
  end if;
  if new_item is null or not exists(select 1 from public.items where item_id = new_item) then
    raise exception 'กรุณาเลือกสินค้าที่มีอยู่ในระบบ';
  end if;
  if new_qty is null or new_qty <= 0 or new_total is null or new_total < 0
    or new_currency is null or new_currency not in ('THB', 'G')
    or p_changes->>'purchased_at' is null then raise exception 'ข้อมูลรายการซื้อไม่ถูกต้อง'; end if;

  if new_item = old_row.item_id then
    if new_qty <> old_row.quantity then
      select quantity into available from public.stocks where item_id = old_row.item_id;
      if coalesce(available, 0) + new_qty - old_row.quantity < 0 then
        raise exception 'สต็อกคงเหลือไม่พอสำหรับลดจำนวนซื้อรายการนี้';
      end if;
      insert into public.stocks(item_id, quantity) values(new_item, coalesce(available, 0) + new_qty - old_row.quantity)
      on conflict (item_id) do update set quantity = excluded.quantity;
    end if;
  else
    select quantity into available from public.stocks where item_id = old_row.item_id;
    if coalesce(available, 0) < old_row.quantity then
      raise exception 'สต็อกสินค้าเดิมไม่พอสำหรับเปลี่ยนรายการสินค้า';
    end if;
    update public.stocks set quantity = quantity - old_row.quantity where item_id = old_row.item_id;
    insert into public.stocks(item_id, quantity) values(new_item, new_qty)
    on conflict (item_id) do update set quantity = stocks.quantity + new_qty;
  end if;

  update public.stock_purchases set item_id = new_item, quantity = new_qty,
    total_amount = new_total, currency = new_currency,
    contributor = nullif(btrim(p_changes->>'contributor'), ''),
    source = nullif(btrim(p_changes->>'source'), ''),
    purchased_at = (p_changes->>'purchased_at')::timestamptz
  where id = p_id returning * into new_row;
  return new_row;
end;
$$;
revoke all on function public.edit_stock_purchase(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.edit_stock_purchase(uuid, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';

-- Budgets are for reporting, not a purchase limit.
-- Run once in Supabase SQL Editor after 20260927_atomic_stock_purchase.sql.

create or replace function public.record_stock_purchase(
  p_item_id text,
  p_quantity integer,
  p_total_amount numeric,
  p_currency text,
  p_source text default null,
  p_contributor text default null
)
returns public.stock_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.stock_purchases;
begin
  if p_item_id is null or btrim(p_item_id) = '' then
    raise exception 'item_id is required';
  end if;
  if not exists (select 1 from public.items where item_id = btrim(p_item_id)) then
    raise exception 'ไม่พบสินค้าในระบบ';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'total_amount cannot be negative';
  end if;
  if p_currency not in ('THB', 'G') then
    raise exception 'currency must be THB or G';
  end if;

  lock table public.stock_purchases, public.stocks in share row exclusive mode;

  insert into public.stock_purchases (item_id, quantity, total_amount, currency, source, contributor)
  values (btrim(p_item_id), p_quantity, p_total_amount, p_currency,
    nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_contributor, '')), ''))
  returning * into v_purchase;

  insert into public.stocks (item_id, quantity)
  values (btrim(p_item_id), p_quantity)
  on conflict (item_id) do update set quantity = public.stocks.quantity + excluded.quantity;

  return v_purchase;
end;
$$;

revoke all on function public.record_stock_purchase(text, integer, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.record_stock_purchase(text, integer, numeric, text, text, text) to service_role;
notify pgrst, 'reload schema';

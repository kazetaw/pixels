-- Preserve existing purchases and add the funding-source field.
alter table public.stock_purchases
  add column if not exists contributor text;

notify pgrst, 'reload schema';

-- Add craft_done flag to contributor_returns
-- When admin marks a return as "หักคราฟเรียบร้อย", craft_done = true
alter table public.contributor_returns add column if not exists craft_done boolean not null default false;
alter table public.contributor_returns add column if not exists craft_done_at timestamptz;

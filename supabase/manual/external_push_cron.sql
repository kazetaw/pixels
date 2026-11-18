-- Run after storing external_push_cron_secret in Supabase Vault.
-- The Vercel CRON_SECRET must match that secret. No credentials belong in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$ begin
 if not exists (select 1 from vault.decrypted_secrets where name='external_push_cron_secret') then
  raise exception 'Store external_push_cron_secret in Vault first';
 end if;
end $$;

-- Scheduling the same job name updates it rather than creating duplicates.
select cron.schedule('external-machine-push', '* * * * *', $job$
 select net.http_post(
  url := 'https://backoffice-pixel.vercel.app/api/external-push-dispatch',
  headers := jsonb_build_object(
   'Content-Type', 'application/json',
   'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='external_push_cron_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 55000
 );
$job$);

select jobname, schedule, active from cron.job where jobname='external-machine-push';

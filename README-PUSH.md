# External machine Web Push

Uses account timers, standard Web Push/VAPID and Supabase Cron once per minute.
Local-only timers must first be imported into the account. Each device opts in.

## Setup

1. Apply `supabase/migrations/20261118_external_push.sql` after the account migration.
2. Run `node scripts/setup-external-push.cjs`. Preserve the generated `.env.push.local`; do not rotate VAPID keys during ordinary deployments.
3. Set its four variables in Vercel Production: `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `CRON_SECRET`. Never use a `VITE_` prefix for private keys.
4. Deploy. Then run the generated **private** `.env.push-cron.sql` in the project's SQL Editor. It stores the dispatcher credential in Vault and schedules `external-machine-push`. The checked-in template is `supabase/manual/external_push_cron.sql`.
5. Log in on the production website, select account data, enable notifications. On iOS 16.4+ open the installed Home Screen app first.

## Verification and operations

- Cron: inspect `cron.job` for `external-machine-push` and recent `cron.job_run_details`. A successful SQL job only queues HTTP; inspect `net._http_response` for HTTP 200 too.
- Dispatcher rejects requests without the matching Bearer credential; a successful response reports claimed/sent/failed counts.
- Set a short test timer in a dedicated test account and verify an OS notification with the page closed. Delivery depends on browser/OS permission and networking; Cron can add about one minute of delay.
- Logout revokes that session's subscriptions. Other devices remain signed in. Reset/delete cancels pending deliveries. Changing the timer reschedules; renaming does not duplicate.
- Claims lease for two minutes; failures retry up to five attempts within 15 minutes. Stable notification tags replace duplicate retries. Expired provider subscriptions are removed. Delivery is best effort, not exactly-once.
- Disable just this job with `select cron.unschedule('external-machine-push');` to stop scheduling.

Tests: `node --import tsx --test scripts/tests/externalPush.test.ts scripts/tests/externalAccounts.test.ts`.

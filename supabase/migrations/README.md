# Supabase migrations

`schema.sql` is the complete schema for a new database. Existing databases run
each numbered `.sql` migration once, in filename order. The central `items`
table owns item names and images; stock, recipe ingredients, and purchases
reference its stable `item_id`.

## Contributor assignments
Run `20260928_contributor_assignments.sql` before using the มอบหมายงาน page.
The API stores each contributor/item pair independently. Assignments reference
`items.item_id` and do not change stocks, budgets, or purchases. Existing hardcoded
profile assignments are not imported automatically; enter them through the page
to resolve each product against the current catalog.

## Warehouse withdrawals
Run `20260929_01_withdrawals.sql` before deploying the withdrawal feature. It adds
transactional reservation and dispatch functions; no existing stock is changed by
the migration. Only `sent` deducts inventory, cancellation releases reservations.
Run `20260929_02_withdrawal_catalog.sql` and `20260929_03_withdrawal_people.sql` next. Admin manages available items in withdrawal_catalog; initial names are seeded by migration 02.
`/admin` is intentionally unauthenticated per the requested workflow; the URL is
not an authorization boundary. Local Vite proxies withdrawals to port 3001
(`npm run dev:api`); other shared read endpoints retain their existing targets.
Regression: install `@electric-sql/pglite` in a temporary directory, then run
`PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node scripts/tests/withdrawals.cjs`.
The organization deadline is fixed to 2026-10-29; assignment_settings is no longer
needed by its UI.

### Withdrawal history and availability
Run `20260929_04_withdrawal_dashboard.sql` before deploying the new paginated
withdrawal API. The RPC returns 10 receipts per page, global filter choices, and
available quantities computed from all pending reservations (independent of the
current search/page). It does not modify inventory.

## Store restock attribution
Run `20261028_01_store_restock_metadata.sql` to add dedicated restock name/tag columns. Until it is applied, the API stores versioned metadata in the existing note column and decodes it when reading history. Historical entries retain a null author; new entries store `entered_by`, `tags`, and the existing database-generated `restocked_at`.

## External machine timers
Run `20261116_external_machine_timers.sql` before deploying the เครื่องนอก page.
It creates independent named timer records and does not change production floors.

## External account POC (2026-11-17)
Run `20261117_external_accounts.sql` before deploying account mode. Existing local
keys and shared `external_machine_timers` rows are not changed or auto-imported.
The same-origin `/api/external-account/*` API uses HttpOnly sessions, scrypt password
hashes and service-role queries scoped to the authenticated owner. Direct browser
access to the account tables and RPCs is disabled by RLS and function grants.
Users explicitly import local timers after login; `(owner_id, import_key)` makes
retries idempotent without overwriting edited cloud copies. New accounts on another
device can only import local entries from that device; import first on the original
browser. Refreshing/focusing account mode retrieves server updates every 15 seconds.
POC limitation: there is no password recovery or account deletion UI yet.
Tests: `node --import tsx --test scripts/tests/externalAccounts.test.ts`.
Optional live test creates/removes only random test accounts:
`EXTERNAL_ACCOUNT_LIVE_TEST=1 node --import tsx scripts/tests/externalAccounts.live.ts`.

Account sessions now use persistent HttpOnly cookies for 90 days. Valid sessions
with fewer than 83 days remaining are extended during authenticated requests;
expired or revoked sessions are never recreated. Logout revokes the current
session only. Browser storage clearing and private browsing may remove cookies.

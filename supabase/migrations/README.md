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

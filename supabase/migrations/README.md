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

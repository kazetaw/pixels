# Supabase migrations

`schema.sql` is the complete schema for a new database. Existing databases run
each numbered `.sql` migration once, in filename order. The central `items`
table owns item names and images; stock, recipe ingredients, and purchases
reference its stable `item_id`.

# Manual Supabase operations

## Reset stock while keeping a restore point

1. Run [stock_backup_and_reset_to_zero.sql](stock_backup_and_reset_to_zero.sql) in Supabase SQL Editor.
2. Copy `restore_backup_id` from the result and save it somewhere safe.
3. Every stock quantity is now `0`; items, images, recipes, machines, budgets, and purchase history are unchanged.
4. Add new stock only through the Budget screen in the app.

## Restore the old balance

1. Open [stock_restore_from_backup.sql](stock_restore_from_backup.sql).
2. Replace `YOUR_BACKUP_ID` with the saved `restore_backup_id`.
3. Run it in Supabase SQL Editor.

Restoring replaces stock quantities for the items in that backup. Do this before recording new purchases if you want the exact previous balance.

## Rebuild stock that was entered after a reset

If purchase history contains entries after the reset but their stock quantities remain zero, use [rebuild_stock_from_purchases_after_reset.sql](rebuild_stock_from_purchases_after_reset.sql). Replace `YOUR_BACKUP_ID` with the same reset backup ID. The script recalculates quantities from purchases recorded after that reset and can be run again safely.

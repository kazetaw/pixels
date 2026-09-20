/**
 * api/recipes/[id].ts  →  PUT /api/recipes/:id  |  DELETE /api/recipes/:id
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  readRecipes,
  updateRecipe,
  deleteRecipe,
  readMachines,
  readStocks,
  getSupabase,
} from '../lib/db.js';
import { findNameConflict, duplicateNameError } from '../lib/names.js';
import type { Recipe, StockMap } from '../lib/types.js';
import { applyCors } from '../lib/cors.js';

/** Sync name → UUID in stocks and ingredient references if old name key exists */
async function syncOldNameToUUID(
  id: string,
  oldName: string,
  stocks: StockMap
): Promise<boolean> {
  if (!Object.prototype.hasOwnProperty.call(stocks, oldName)) return false;

  const db = getSupabase();
  const qty = stocks[oldName] ?? 0;
  await db.from('stocks').delete().eq('item_id', oldName);
  await db
    .from('stocks')
    .upsert({ item_id: id, quantity: qty }, { onConflict: 'item_id' });

  const recipes = await readRecipes();
  for (const r of recipes) {
    if (!Object.prototype.hasOwnProperty.call(r.ingredients, oldName)) continue;
    const newIng = { ...r.ingredients };
    const existingQty = newIng[oldName];
    delete newIng[oldName];
    newIng[id] = (newIng[id] ?? 0) + existingQty;
    await db.from('recipes').update({ ingredients: newIng }).eq('id', r.id);
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  // ── PUT ────────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = req.body as Partial<Recipe>;

    try {
      const [recipes, machines, stocks] = await Promise.all([
        readRecipes(),
        readMachines(),
        readStocks(),
      ]);

      const existing = recipes.find((r) => r.id === id);
      if (!existing) return res.status(404).json({ error: `Recipe "${id}" not found` });

      const newName = (body.name ?? existing.name).trim();
      if (!newName) return res.status(400).json({ error: 'name is required' });

      const conflict = findNameConflict(newName, {
        recipes,
        machines,
        stocks,
        excludeRecipeId: id,
      });
      if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });

      const updated = await updateRecipe(id, {
        name:          newName,
        machine_id:    body.machine_id    !== undefined ? body.machine_id    : existing.machine_id,
        time_per_unit: body.time_per_unit !== undefined ? body.time_per_unit : existing.time_per_unit,
        ingredients:   body.ingredients   !== undefined ? body.ingredients   : existing.ingredients,
        image:         body.image         !== undefined ? body.image         : existing.image,
      });

      // If name changed, check if old name was a stock key
      let migrated = false;
      if (newName !== existing.name) {
        migrated = await syncOldNameToUUID(id, existing.name, stocks);
      }
      // Also check if new name matches a raw stock key
      if (!migrated) {
        migrated = await syncOldNameToUUID(id, newName, await readStocks());
      }

      res.json({ ...updated, _synced: migrated });
    } catch (err) {
      console.error('PUT /api/recipes/:id error:', err);
      res.status(500).json({ error: 'Failed to update recipe' });
    }
    return;
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const recipes = await readRecipes();
      const exists = recipes.some((r) => r.id === id);
      if (!exists) return res.status(404).json({ error: `Recipe "${id}" not found` });

      await deleteRecipe(id);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/recipes/:id error:', err);
      res.status(500).json({ error: 'Failed to delete recipe' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

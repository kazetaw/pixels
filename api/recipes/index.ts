/**
 * api/recipes/index.ts  →  GET /api/recipes  |  POST /api/recipes
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  readRecipes,
  insertRecipe,
  readMachines,
  readStocks,
  getSupabase,
} from '../lib/db.js';
import { findNameConflict, duplicateNameError } from '../lib/names.js';
import type { Recipe, StockMap } from '../lib/types.js';
import { applyCors } from '../lib/cors.js';

/** When a new recipe name matches an existing raw-material stock key, rename key → UUID */
async function syncNameToUUID(
  newId: string,
  name: string,
  stocks: StockMap
): Promise<{ migrated: boolean }> {
  const trimmedName = name.trim();
  if (!Object.prototype.hasOwnProperty.call(stocks, trimmedName)) {
    return { migrated: false };
  }

  const db = getSupabase();
  const qty = stocks[trimmedName] ?? 0;

  // Rename stock key: trimmedName → newId
  await db.from('stocks').delete().eq('item_id', trimmedName);
  await db
    .from('stocks')
    .upsert({ item_id: newId, quantity: qty }, { onConflict: 'item_id' });

  // Rename ingredient references across all recipes that used the old name key
  const recipes = await readRecipes();
  for (const r of recipes) {
    if (!Object.prototype.hasOwnProperty.call(r.ingredients, trimmedName)) continue;
    const newIng = { ...r.ingredients };
    const existingQty = newIng[trimmedName];
    delete newIng[trimmedName];
    newIng[newId] = (newIng[newId] ?? 0) + existingQty;
    await db.from('recipes').update({ ingredients: newIng }).eq('id', r.id);
  }

  return { migrated: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      res.json(await readRecipes());
    } catch (err) {
      console.error('GET /api/recipes error:', err);
      res.status(500).json({ error: 'Failed to read recipes' });
    }
    return;
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body as Partial<Recipe>;
    if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' });

    try {
      const [recipes, machines, stocks] = await Promise.all([
        readRecipes(),
        readMachines(),
        readStocks(),
      ]);

      const conflict = findNameConflict(body.name, { recipes, machines, stocks });
      if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });

      const newRecipe = await insertRecipe({
        name:          body.name.trim(),
        machine_id:    body.machine_id ?? null,
        time_per_unit: body.time_per_unit ?? null,
        ingredients:   body.ingredients ?? {},
        image:         body.image,
      });

      const { migrated } = await syncNameToUUID(newRecipe.id, newRecipe.name, stocks);

      res.status(201).json({ ...newRecipe, _synced: migrated });
    } catch (err) {
      console.error('POST /api/recipes error:', err);
      res.status(500).json({ error: 'Failed to create recipe' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

/**
 * api/data.ts  →  GET /api/data
 * Returns all recipes, machines (with computed max_hours_limit), stocks, and stock images.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readMachines, readRecipes, readStocks, readStockImages } from './lib/db.js';
import { parseTimeToHours } from './lib/time.js';
import type { Machine, Recipe } from './lib/types.js';
import { applyCors } from './lib/cors.js';

function enrichMachines(machines: Machine[], recipes: Recipe[]): Machine[] {
  const maxHoursMap = new Map<string, number>();
  for (const recipe of recipes) {
    if (!recipe.time_per_unit || !recipe.machine_id) continue;
    const h = parseTimeToHours(recipe.time_per_unit);
    const current = maxHoursMap.get(recipe.machine_id) ?? 0;
    if (h > current) maxHoursMap.set(recipe.machine_id, h);
  }
  return machines.map((m) => ({
    ...m,
    max_hours_limit: maxHoursMap.get(m.machine_id) ?? 0,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [recipes, machines, stocks, stockImages] = await Promise.all([
      readRecipes(),
      readMachines(),
      readStocks(),
      readStockImages(),
    ]);
    res.json({
      recipes,
      machines: enrichMachines(machines, recipes),
      stocks,
      stockImages,
    });
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to read data' });
  }
}

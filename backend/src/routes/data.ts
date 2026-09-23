import { Router, Request, Response } from 'express';
import { readRecipes, readMachines, readStocks, readStockImages } from '../services/fileStore';
import { parseTimeToHours } from '../utils/time';
import { Machine, Recipe } from '../types';

const router = Router();

/** Compute max_hours_limit for each machine from recipes (shared logic) */
export function enrichMachines(machines: Machine[], recipes: Recipe[]): Machine[] {
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

/**
 * GET /api/data
 * Returns all recipes, machines (with computed max_hours_limit), and stocks.
 */
router.get('/api/data', async (_req: Request, res: Response) => {
  try {
    const [recipes, machines, stocks, stockImages] = await Promise.all([
      readRecipes(),
      readMachines(),
      readStocks(),
      readStockImages(),
    ]);
    res.json({ recipes, machines: enrichMachines(machines, recipes), stocks, stockImages });
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to read data files' });
  }
});

export default router;

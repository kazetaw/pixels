/**
 * api/machines/index.ts  →  GET /api/machines  |  POST /api/machines
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  readMachines,
  insertMachine,
  readRecipes,
  readStocks,
} from '../lib/db.js';
import { parseTimeToHours } from '../lib/time.js';
import { findNameConflict, duplicateNameError } from '../lib/names.js';
import type { Machine, Recipe } from '../lib/types.js';
import { applyCors } from '../lib/cors.js';

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

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [machines, recipes] = await Promise.all([readMachines(), readRecipes()]);
      res.json(enrichMachines(machines, recipes));
    } catch (err) {
      console.error('GET /api/machines error:', err);
      res.status(500).json({ error: 'Failed to read machines' });
    }
    return;
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body as Partial<Machine>;

    if (!body.machine_name?.trim())
      return res.status(400).json({ error: 'machine_name is required' });
    if (typeof body.floor_number !== 'number' || body.floor_number < 1)
      return res.status(400).json({ error: 'floor_number must be a positive number' });

    try {
      const [machines, recipes, stocks] = await Promise.all([
        readMachines(),
        readRecipes(),
        readStocks(),
      ]);

      const conflict = findNameConflict(body.machine_name, { recipes, machines, stocks });
      if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });

      const newMachine = await insertMachine({
        machine_name: body.machine_name.trim(),
        floor_number: body.floor_number,
        occupation:   body.occupation,
        image:        body.image,
      });

      const [enriched] = enrichMachines([newMachine], recipes);
      res.status(201).json(enriched);
    } catch (err) {
      console.error('POST /api/machines error:', err);
      res.status(500).json({ error: 'Failed to create machine' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

/**
 * api/machines/[id].ts  →  PUT /api/machines/:id  |  DELETE /api/machines/:id
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  readMachines,
  updateMachine,
  deleteMachine,
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

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'id is required' });

  // ── PUT ────────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = req.body as Partial<Machine>;

    try {
      const [machines, recipes, stocks] = await Promise.all([
        readMachines(),
        readRecipes(),
        readStocks(),
      ]);

      const existing = machines.find((m) => m.machine_id === id);
      if (!existing) return res.status(404).json({ error: `Machine "${id}" not found` });

      const requestedName = (body.machine_name ?? existing.machine_name).trim();
      if (!requestedName) return res.status(400).json({ error: 'machine_name is required' });

      const conflict = findNameConflict(requestedName, {
        recipes,
        machines,
        stocks,
        excludeMachineId: id,
      });
      if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });

      const updated = await updateMachine(id, {
        machine_name: requestedName,
        floor_number: body.floor_number ?? existing.floor_number,
        occupation:   body.occupation   !== undefined ? body.occupation   : existing.occupation,
        image:        body.image        !== undefined ? body.image        : existing.image,
      });

      const [enriched] = enrichMachines([updated], recipes);
      res.json(enriched);
    } catch (err) {
      console.error('PUT /api/machines/:id error:', err);
      res.status(500).json({ error: 'Failed to update machine' });
    }
    return;
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const machines = await readMachines();
      const exists = machines.some((m) => m.machine_id === id);
      if (!exists) return res.status(404).json({ error: `Machine "${id}" not found` });

      await deleteMachine(id);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/machines/:id error:', err);
      res.status(500).json({ error: 'Failed to delete machine' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

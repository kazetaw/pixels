import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { readMachines, writeMachines, readRecipes } from '../services/fileStore';
import { parseTimeToHours } from '../utils/time';
import { Machine } from '../types';

const router = Router();

/**
 * Compute max_hours_limit for each machine by scanning recipes.
 * For a given machine_id, find all recipes assigned to it and take
 * the maximum time_per_unit (in hours). Falls back to 0 if none found.
 */
function computeMaxHours(machines: Machine[], recipes: Awaited<ReturnType<typeof readRecipes>>): Machine[] {
  // Build map: machine_id → max time_per_unit in hours across its recipes
  const maxHoursMap = new Map<string, number>();
  for (const recipe of recipes) {
    if (!recipe.time_per_unit) continue;
    const h = parseTimeToHours(recipe.time_per_unit);
    const current = maxHoursMap.get(recipe.machine_id) ?? 0;
    if (h > current) maxHoursMap.set(recipe.machine_id, h);
  }

  return machines.map((m) => ({
    ...m,
    max_hours_limit: maxHoursMap.get(m.machine_id) ?? 0,
  }));
}

/** GET /api/machines — list all, with max_hours_limit computed from recipes */
router.get('/api/machines', async (_req: Request, res: Response) => {
  try {
    const [machines, recipes] = await Promise.all([readMachines(), readRecipes()]);
    res.json(computeMaxHours(machines, recipes));
  } catch {
    res.status(500).json({ error: 'Failed to read machines' });
  }
});

/** POST /api/machines — create new machine (max_hours_limit not stored, computed on read) */
router.post('/api/machines', async (req: Request, res: Response) => {
  const body = req.body as Partial<Machine>;

  if (!body.machine_name?.trim())
    return res.status(400).json({ error: 'machine_name is required' });
  if (typeof body.floor_number !== 'number' || body.floor_number < 1)
    return res.status(400).json({ error: 'floor_number must be a positive number' });

  try {
    const [machines, recipes] = await Promise.all([readMachines(), readRecipes()]);

    const newMachine: Machine = {
      machine_id:      randomUUID(),
      machine_name:    body.machine_name.trim(),
      floor_number:    body.floor_number,
      max_hours_limit: 0, // will be computed on read
      ...(body.image      !== undefined && { image: body.image }),
      ...(body.occupation !== undefined && { occupation: body.occupation }),
    };

    machines.push(newMachine);
    machines.sort((a, b) => a.floor_number - b.floor_number);
    await writeMachines(machines);

    // Return with computed max_hours_limit
    const [computed] = computeMaxHours([newMachine], recipes);
    res.status(201).json(computed);
  } catch {
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

/** PUT /api/machines/:id — update machine fields (max_hours_limit not accepted) */
router.put('/api/machines/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Partial<Machine>;

  try {
    const [machines, recipes] = await Promise.all([readMachines(), readRecipes()]);
    const idx = machines.findIndex((m) => m.machine_id === id);
    if (idx === -1)
      return res.status(404).json({ error: `Machine "${id}" not found` });

    const updated: Machine = {
      ...machines[idx],
      machine_name:    body.machine_name?.trim() ?? machines[idx].machine_name,
      floor_number:    body.floor_number          ?? machines[idx].floor_number,
      max_hours_limit: machines[idx].max_hours_limit, // keep stored value, overwritten on read
      ...(body.image      !== undefined && { image: body.image }),
      ...(body.occupation !== undefined && { occupation: body.occupation }),
    };

    machines[idx] = updated;
    machines.sort((a, b) => a.floor_number - b.floor_number);
    await writeMachines(machines);

    const [computed] = computeMaxHours([updated], recipes);
    res.json(computed);
  } catch {
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

/** DELETE /api/machines/:id */
router.delete('/api/machines/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const machines = await readMachines();
    const filtered = machines.filter((m) => m.machine_id !== id);
    if (filtered.length === machines.length)
      return res.status(404).json({ error: `Machine "${id}" not found` });
    await writeMachines(filtered);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

export default router;

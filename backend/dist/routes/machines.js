"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const fileStore_1 = require("../services/fileStore");
const time_1 = require("../utils/time");
const names_1 = require("../utils/names");
const router = (0, express_1.Router)();
/**
 * Compute max_hours_limit for each machine by scanning recipes.
 * For a given machine_id, find all recipes assigned to it and take
 * the maximum time_per_unit (in hours). Falls back to 0 if none found.
 */
function computeMaxHours(machines, recipes) {
    // Build map: machine_id → max time_per_unit in hours across its recipes
    const maxHoursMap = new Map();
    for (const recipe of recipes) {
        if (!recipe.time_per_unit)
            continue;
        const h = (0, time_1.parseTimeToHours)(recipe.time_per_unit);
        const current = maxHoursMap.get(recipe.machine_id) ?? 0;
        if (h > current)
            maxHoursMap.set(recipe.machine_id, h);
    }
    return machines.map((m) => ({
        ...m,
        max_hours_limit: maxHoursMap.get(m.machine_id) ?? 0,
    }));
}
/** GET /api/machines — list all, with max_hours_limit computed from recipes */
router.get('/api/machines', async (_req, res) => {
    try {
        const [machines, recipes, stocks] = await Promise.all([(0, fileStore_1.readMachines)(), (0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)()]);
        const conflict = (0, names_1.findNameConflict)(body.machine_name, { recipes, machines, stocks });
        if (conflict)
            return res.status(409).json({ error: (0, names_1.duplicateNameError)(conflict) });
        res.json(computeMaxHours(machines, recipes));
    }
    catch {
        res.status(500).json({ error: 'Failed to read machines' });
    }
});
/** POST /api/machines — create new machine (max_hours_limit not stored, computed on read) */
router.post('/api/machines', async (req, res) => {
    const body = req.body;
    if (!body.machine_name?.trim())
        return res.status(400).json({ error: 'machine_name is required' });
    if (typeof body.floor_number !== 'number' || body.floor_number < 1)
        return res.status(400).json({ error: 'floor_number must be a positive number' });
    try {
        const [machines, recipes, stocks] = await Promise.all([(0, fileStore_1.readMachines)(), (0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)()]);
        const newMachine = {
            machine_id: (0, crypto_1.randomUUID)(),
            machine_name: body.machine_name.trim(),
            floor_number: body.floor_number,
            max_hours_limit: 0, // will be computed on read
            ...(body.image !== undefined && { image: body.image }),
            ...(body.occupation !== undefined && { occupation: body.occupation }),
        };
        machines.push(newMachine);
        machines.sort((a, b) => a.floor_number - b.floor_number);
        await (0, fileStore_1.writeMachines)(machines);
        // Return with computed max_hours_limit
        const [computed] = computeMaxHours([newMachine], recipes);
        res.status(201).json(computed);
    }
    catch {
        res.status(500).json({ error: 'Failed to create machine' });
    }
});
/** PUT /api/machines/:id — update machine fields (max_hours_limit not accepted) */
router.put('/api/machines/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    try {
        const [machines, recipes] = await Promise.all([(0, fileStore_1.readMachines)(), (0, fileStore_1.readRecipes)()]);
        const idx = machines.findIndex((m) => m.machine_id === id);
        if (idx === -1)
            return res.status(404).json({ error: `Machine "${id}" not found` });
        const requestedName = body.machine_name ?? machines[idx].machine_name;
        if (!requestedName.trim())
            return res.status(400).json({ error: 'machine_name is required' });
        const conflict = (0, names_1.findNameConflict)(requestedName, { recipes, machines, stocks, excludeMachineId: id });
        if (conflict)
            return res.status(409).json({ error: (0, names_1.duplicateNameError)(conflict) });
        const updated = {
            ...machines[idx],
            machine_name: body.machine_name?.trim() ?? machines[idx].machine_name,
            floor_number: body.floor_number ?? machines[idx].floor_number,
            max_hours_limit: machines[idx].max_hours_limit, // keep stored value, overwritten on read
            ...(body.image !== undefined && { image: body.image }),
            ...(body.occupation !== undefined && { occupation: body.occupation }),
        };
        machines[idx] = updated;
        machines.sort((a, b) => a.floor_number - b.floor_number);
        await (0, fileStore_1.writeMachines)(machines);
        const [computed] = computeMaxHours([updated], recipes);
        res.json(computed);
    }
    catch {
        res.status(500).json({ error: 'Failed to update machine' });
    }
});
/** DELETE /api/machines/:id */
router.delete('/api/machines/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const machines = await (0, fileStore_1.readMachines)();
        const filtered = machines.filter((m) => m.machine_id !== id);
        if (filtered.length === machines.length)
            return res.status(404).json({ error: `Machine "${id}" not found` });
        await (0, fileStore_1.writeMachines)(filtered);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete machine' });
    }
});
exports.default = router;

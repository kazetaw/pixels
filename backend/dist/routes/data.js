"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichMachines = void 0;
const express_1 = require("express");
const fileStore_1 = require("../services/fileStore");
const time_1 = require("../utils/time");
const router = (0, express_1.Router)();
/** Compute max_hours_limit for each machine from recipes (shared logic) */
function enrichMachines(machines, recipes) {
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
exports.enrichMachines = enrichMachines;
/**
 * GET /api/data
 * Returns all recipes, machines (with computed max_hours_limit), and stocks.
 */
router.get('/api/data', async (_req, res) => {
    try {
        const [recipes, machines, stocks, stockImages] = await Promise.all([
            (0, fileStore_1.readRecipes)(),
            (0, fileStore_1.readMachines)(),
            (0, fileStore_1.readStocks)(),
            (0, fileStore_1.readStockImages)(),
        ]);
        res.json({ recipes, machines: enrichMachines(machines, recipes), stocks, stockImages });
    }
    catch (err) {
        console.error('GET /api/data error:', err);
        res.status(500).json({ error: 'Failed to read data files' });
    }
});
exports.default = router;

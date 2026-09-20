"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fileStore_1 = require("../services/fileStore");
const migrator_1 = require("../services/migrator");
const router = (0, express_1.Router)();
/** GET /api/diagnose — scan and report conflicts without fixing anything */
router.get('/api/diagnose', async (_req, res) => {
    try {
        const [recipes, stocks] = await Promise.all([(0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)()]);
        const nameToId = new Map(recipes.map((r) => [r.name.trim(), r.id]));
        const conflicts = [];
        // 1. Stock keys that are recipe names (should be UUIDs)
        for (const [key, qty] of Object.entries(stocks)) {
            const uuid = nameToId.get(key);
            if (uuid && uuid !== key) {
                conflicts.push({
                    type: 'stock_key',
                    description: `สต็อก "${key}" ควรใช้ UUID ของ recipe "${key}"`,
                    currentKey: key,
                    targetUUID: uuid,
                    recipeName: 'สต็อก',
                    currentQty: qty,
                });
            }
        }
        // 2. Ingredient keys that are recipe names (should be UUIDs)
        for (const recipe of recipes) {
            for (const [key, qty] of Object.entries(recipe.ingredients)) {
                const uuid = nameToId.get(key);
                if (uuid && uuid !== key) {
                    conflicts.push({
                        type: 'ingredient_ref',
                        description: `Recipe "${recipe.name}" → ingredient "${key}" ควรใช้ UUID`,
                        currentKey: key,
                        targetUUID: uuid,
                        recipeName: recipe.name,
                        currentQty: qty,
                    });
                }
            }
        }
        const result = {
            conflicts,
            totalConflicts: conflicts.length,
            isClean: conflicts.length === 0,
        };
        res.json(result);
    }
    catch (err) {
        console.error('GET /api/diagnose error:', err);
        res.status(500).json({ error: 'Diagnose failed' });
    }
});
/** POST /api/migrate — run migration (fix all conflicts) */
router.post('/api/migrate', async (_req, res) => {
    try {
        const report = await (0, migrator_1.runMigration)();
        res.json({
            ok: true,
            message: report.totalChanges > 0
                ? `แก้ไข ${report.stocksFixed.length} stock keys และ ${report.ingredientsFixed.length} ingredient refs`
                : 'ไม่พบ conflict — ข้อมูลสะอาดแล้ว',
            report,
        });
    }
    catch (err) {
        console.error('POST /api/migrate error:', err);
        res.status(500).json({ error: 'Migration failed' });
    }
});
exports.default = router;

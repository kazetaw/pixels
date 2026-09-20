"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fileStore_1 = require("../services/fileStore");
const bomCalculator_1 = require("../services/bomCalculator");
const router = (0, express_1.Router)();
/**
 * POST /api/calculate
 * Performs recursive BOM explosion for all target items.
 * Body: Array of { target_item_id: string, target_quantity: number }
 * Requirements: 4.1, 4.6, 4.10
 */
router.post('/api/calculate', async (req, res) => {
    const body = req.body;
    // Validate: must be a non-empty array
    if (!Array.isArray(body) || body.length === 0) {
        return res.status(400).json({ error: 'Request body must be a non-empty array of target items' });
    }
    // Validate each target item
    for (let i = 0; i < body.length; i++) {
        const item = body[i];
        if (!item || typeof item !== 'object') {
            return res.status(400).json({ error: `Item at index ${i} must be an object` });
        }
        if (typeof item.target_item_id !== 'string' || !item.target_item_id.trim()) {
            return res.status(400).json({ error: `Item at index ${i} is missing a valid target_item_id` });
        }
        if (typeof item.target_quantity !== 'number' || item.target_quantity <= 0) {
            return res.status(400).json({ error: `Item at index ${i} must have a positive target_quantity` });
        }
    }
    try {
        const [recipes, machines, stocks] = await Promise.all([
            (0, fileStore_1.readRecipes)(),
            (0, fileStore_1.readMachines)(),
            (0, fileStore_1.readStocks)(),
        ]);
        // Build the set of all known item IDs: recipe outputs and all ingredients
        const allKnownItems = new Set();
        for (const recipe of recipes) {
            allKnownItems.add(recipe.id);
            for (const ingredientId of Object.keys(recipe.ingredients)) {
                allKnownItems.add(ingredientId);
            }
        }
        // Validate that each target_item_id is a known item
        for (const item of body) {
            if (!allKnownItems.has(item.target_item_id)) {
                return res.status(400).json({
                    error: `Unknown target_item_id: "${item.target_item_id}". Item not found in any recipe.`,
                });
            }
        }
        const result = (0, bomCalculator_1.calculate)(body, recipes, machines, stocks);
        res.json(result);
    }
    catch (err) {
        console.error('POST /api/calculate error:', err);
        res.status(500).json({ error: 'Calculation failed due to a server error' });
    }
});
exports.default = router;

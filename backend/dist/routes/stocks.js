"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fileStore_1 = require("../services/fileStore");
const names_1 = require("../utils/names");
const router = (0, express_1.Router)();
/**
 * POST /api/stocks
 * Body: { stocks: StockMap, images?: StockImageMap }
 * Overwrites stocks.json (and optionally stock_images.json).
 */
router.post('/api/stocks', async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Request body must be an object' });
    }
    // Support both legacy format { key: qty, ... } and new format { stocks: {...}, images: {...} }
    let stockMap;
    let imageMap;
    if (body.stocks !== undefined) {
        // New format
        stockMap = body.stocks;
        imageMap = body.images;
    }
    else {
        // Legacy format — plain StockMap
        stockMap = body;
    }
    // Validate stock values are numbers
    for (const [key, value] of Object.entries(stockMap)) {
        if (typeof value !== 'number') {
            return res.status(400).json({ error: `Invalid value for item "${key}": expected a number` });
        }
    }
    try {
        const [recipes, machines] = await Promise.all([(0, fileStore_1.readRecipes)(), (0, fileStore_1.readMachines)()]);
        const recipeIds = new Set(recipes.map((recipe) => recipe.id));
        const rawNames = new Map();
        for (const key of Object.keys(stockMap)) {
            if (recipeIds.has(key))
                continue;
            const normalized = (0, names_1.normalizeName)(key);
            if (!normalized)
                return res.status(400).json({ error: 'ชื่อวัตถุดิบต้องไม่ว่าง' });
            const duplicate = rawNames.get(normalized);
            if (duplicate)
                return res.status(409).json({ error: `ชื่อวัตถุดิบซ้ำ: "${duplicate}" และ "${key}"` });
            rawNames.set(normalized, key);
            const conflict = (0, names_1.findNameConflict)(key, { recipes, machines, stocks: {} });
            if (conflict)
                return res.status(409).json({ error: (0, names_1.duplicateNameError)(conflict) });
        }
        if (imageMap) {
            await Promise.all([(0, fileStore_1.writeStocks)(stockMap), (0, fileStore_1.writeStockImages)(imageMap)]);
        }
        else {
            await (0, fileStore_1.writeStocks)(stockMap);
        }
        res.json({ ok: true });
    }
    catch (err) {
        console.error('POST /api/stocks error:', err);
        res.status(500).json({ error: 'Failed to write stocks file' });
    }
});
/**
 * GET /api/stock-images
 * Returns the current stock image map.
 */
router.get('/api/stock-images', async (_req, res) => {
    try {
        res.json(await (0, fileStore_1.readStockImages)());
    }
    catch (err) {
        console.error('GET /api/stock-images error:', err);
        res.status(500).json({ error: 'Failed to read stock images' });
    }
});
exports.default = router;

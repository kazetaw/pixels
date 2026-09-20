"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fileStore_1 = require("../services/fileStore");
const time_1 = require("../utils/time");
const router = (0, express_1.Router)();
const SLOTS_DEFAULT = 12;
// ── helpers ───────────────────────────────────────────────────────────────────
/** Convert event duration to total hours */
function toHours(days, hours = 0, minutes = 0) {
    return days * 24 + hours + minutes / 60;
}
/** Recursively build a BOM tree node for `quantity` units of `itemId` */
function buildTree(itemId, quantity, recipeMap, nameMap, floorProducesMap) {
    const recipe = recipeMap.get(itemId);
    const name = nameMap.get(itemId) ?? itemId;
    if (!recipe || Object.keys(recipe.ingredients).length === 0) {
        // Leaf / raw material
        return {
            item_id: itemId,
            item_name: name,
            quantity_needed: quantity,
            is_raw: true,
            children: [],
        };
    }
    const children = Object.entries(recipe.ingredients).map(([ingId, ingQty]) => buildTree(ingId, ingQty * quantity, recipeMap, nameMap, floorProducesMap));
    return {
        item_id: itemId,
        item_name: name,
        quantity_needed: quantity,
        is_raw: false,
        produced_by_floor: floorProducesMap.get(itemId),
        children,
    };
}
/** Walk a BOM tree and accumulate raw material totals */
function accumulateRaw(node, acc) {
    if (node.is_raw) {
        const existing = acc.get(node.item_id);
        acc.set(node.item_id, {
            name: node.item_name,
            qty: (existing?.qty ?? 0) + node.quantity_needed,
        });
        return;
    }
    for (const child of node.children)
        accumulateRaw(child, acc);
}
/** Walk a BOM tree and accumulate intermediate product consumption */
function accumulateIntermediate(node, acc) {
    if (!node.is_raw) {
        // Every non-raw child that is itself non-raw = intermediate consumed by parent
        for (const child of node.children) {
            if (!child.is_raw) {
                const existing = acc.get(child.item_id);
                acc.set(child.item_id, {
                    name: child.item_name,
                    needed: (existing?.needed ?? 0) + child.quantity_needed,
                });
            }
            accumulateIntermediate(child, acc);
        }
    }
}
// ── route ─────────────────────────────────────────────────────────────────────
router.post('/api/plan', async (req, res) => {
    const body = req.body;
    // Basic validation
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Request body is required' });
    }
    if (typeof body.event_days !== 'number' || body.event_days <= 0) {
        return res.status(400).json({ error: 'event_days must be a positive number' });
    }
    if (!Array.isArray(body.floor_assignments) || body.floor_assignments.length === 0) {
        return res.status(400).json({ error: 'floor_assignments must be a non-empty array' });
    }
    const slotsPerFloor = body.slots_per_floor ?? SLOTS_DEFAULT;
    const eventHours = toHours(body.event_days, body.event_hours, body.event_minutes);
    try {
        const [recipes, stocks] = await Promise.all([(0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)()]);
        const recipeMap = new Map(recipes.map((r) => [r.id, r]));
        // Build name map: id → name (for all recipes)
        const nameMap = new Map(recipes.map((r) => [r.id, r.name]));
        // Validate all recipe_ids exist
        for (const fa of body.floor_assignments) {
            if (!recipeMap.has(fa.recipe_id)) {
                return res.status(400).json({
                    error: `Unknown recipe_id "${fa.recipe_id}" for floor ${fa.floor_number}`,
                });
            }
        }
        // Map recipe_id → floor_number (first floor that produces it, for BOM tree annotation)
        const floorProducesMap = new Map();
        for (const fa of body.floor_assignments) {
            if (!floorProducesMap.has(fa.recipe_id)) {
                floorProducesMap.set(fa.recipe_id, fa.floor_number);
            }
        }
        // Also add recipe.id → recipe.id into floorProducesMap (so tree can look up)
        // Actually floorProducesMap key = recipe_id, which IS item_id for produced items — correct
        // ── Per-floor results ──────────────────────────────────────────────────────
        const floorResults = [];
        for (const fa of body.floor_assignments) {
            const recipe = recipeMap.get(fa.recipe_id);
            // If time_per_unit is null → can't cycle-produce on a machine
            const timePerUnitHours = (0, time_1.parseTimeToHours)(recipe.time_per_unit);
            const cycles = timePerUnitHours > 0 ? Math.floor(eventHours / timePerUnitHours) : 0;
            const outputQty = cycles * slotsPerFloor;
            const bomTree = buildTree(recipe.id, outputQty, recipeMap, nameMap, floorProducesMap);
            floorResults.push({
                floor_number: fa.floor_number,
                recipe_id: recipe.id,
                recipe_name: recipe.name,
                time_per_unit: recipe.time_per_unit ?? '00:00:00',
                cycles,
                output_qty: outputQty,
                bom_tree: bomTree,
            });
        }
        // ── Aggregate raw materials across all floors ──────────────────────────────
        const rawAcc = new Map();
        for (const fr of floorResults) {
            accumulateRaw(fr.bom_tree, rawAcc);
        }
        const raw_materials = Array.from(rawAcc.entries()).map(([itemId, { name, qty }]) => {
            const inStock = stocks[itemId] ?? 0;
            return {
                item_id: itemId,
                item_name: name,
                total_needed: qty,
                in_stock: inStock,
                net_required: Math.max(0, qty - inStock),
                sufficient: inStock >= qty,
            };
        });
        // Sort: insufficient first, then by total_needed desc
        raw_materials.sort((a, b) => {
            if (a.sufficient !== b.sufficient)
                return a.sufficient ? 1 : -1;
            return b.total_needed - a.total_needed;
        });
        // ── Intermediate supply validation ─────────────────────────────────────────
        // How much of each intermediate is consumed (as ingredient) across all floor outputs
        const intermediateNeededAcc = new Map();
        for (const fr of floorResults) {
            accumulateIntermediate(fr.bom_tree, intermediateNeededAcc);
        }
        // How much of each intermediate is produced by floor assignments
        const intermediateProducedAcc = new Map();
        for (const fr of floorResults) {
            const prev = intermediateProducedAcc.get(fr.recipe_id) ?? 0;
            intermediateProducedAcc.set(fr.recipe_id, prev + fr.output_qty);
        }
        const intermediate_supply = [];
        for (const [itemId, { name, needed }] of intermediateNeededAcc.entries()) {
            const produced = intermediateProducedAcc.get(itemId) ?? 0;
            intermediate_supply.push({
                item_id: itemId,
                item_name: name,
                needed,
                produced,
                sufficient: produced >= needed,
                shortfall: Math.max(0, needed - produced),
            });
        }
        // Sort: insufficient first
        intermediate_supply.sort((a, b) => {
            if (a.sufficient !== b.sufficient)
                return a.sufficient ? 1 : -1;
            return b.shortfall - a.shortfall;
        });
        const response = {
            event_total_hours: eventHours,
            floor_results: floorResults,
            intermediate_supply,
            raw_materials,
        };
        res.json(response);
    }
    catch (err) {
        console.error('POST /api/plan error:', err);
        res.status(500).json({ error: 'Production plan calculation failed' });
    }
});
exports.default = router;

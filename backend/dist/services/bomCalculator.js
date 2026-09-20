"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculate = calculate;
const time_1 = require("../utils/time");
/**
 * Convert a snake_case identifier to Title Case.
 * e.g. "iron_ore" → "Iron Ore"
 */
function snakeToTitleCase(id) {
    return id
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
/**
 * Recursively explode the BOM for a single item tier.
 *
 * @param itemId           - The item to produce
 * @param quantityNeeded   - Gross quantity needed at this tier (before stock deduction)
 * @param recipeMap        - Map of item id → Recipe
 * @param workingStock     - Mutable stock copy; deducted as the tree is traversed
 * @param rawNetMap        - Accumulates NET quantities for leaf (raw-material) nodes
 * @param rawTotalMap      - Accumulates GROSS quantities for leaf nodes (before own-tier deduction)
 * @param machineHoursMap  - Accumulates production hours per machine_id
 */
function explode(itemId, quantityNeeded, recipeMap, workingStock, rawNetMap, rawTotalMap, machineHoursMap) {
    // Step 1 – Deduct available stock for this tier
    const available = workingStock[itemId] ?? 0;
    const netQty = Math.max(0, quantityNeeded - available);
    workingStock[itemId] = Math.max(0, available - quantityNeeded);
    // Step 2 – Stock fully covers this tier; nothing more to do
    if (netQty === 0)
        return;
    // Step 3 – Look up recipe
    const recipe = recipeMap.get(itemId);
    // Step 4 – No recipe → raw material (leaf node)
    if (!recipe) {
        rawTotalMap.set(itemId, (rawTotalMap.get(itemId) ?? 0) + quantityNeeded);
        rawNetMap.set(itemId, (rawNetMap.get(itemId) ?? 0) + netQty);
        return;
    }
    // Step 5 – Accumulate machine hours (skip if time_per_unit is null)
    if (recipe.time_per_unit !== null) {
        const hoursPerUnit = (0, time_1.parseTimeToHours)(recipe.time_per_unit);
        machineHoursMap.set(recipe.machine_id, (machineHoursMap.get(recipe.machine_id) ?? 0) + netQty * hoursPerUnit);
    }
    // Step 6 – Recurse into each ingredient
    for (const [ingredientId, ingredientQty] of Object.entries(recipe.ingredients)) {
        explode(ingredientId, ingredientQty * netQty, recipeMap, workingStock, rawNetMap, rawTotalMap, machineHoursMap);
    }
}
/**
 * Perform recursive BOM explosion for all target items, applying simple
 * per-tier stock deduction, and return a shopping list and machine workload summary.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
 */
function calculate(targets, recipes, machines, stocks) {
    // Build lookup maps
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    const machineMap = new Map(machines.map((m) => [m.machine_id, m]));
    // Build item-name map from recipes (covers intermediate products as well)
    const itemNameMap = new Map(recipes.map((r) => [r.id, r.name]));
    // Mutable working copy of stock so deductions don't affect the caller's data
    const workingStock = { ...stocks };
    // Accumulators
    const rawNetMap = new Map();
    const rawTotalMap = new Map();
    const machineHoursMap = new Map();
    // Explode each target
    for (const target of targets) {
        explode(target.target_item_id, target.target_quantity, recipeMap, workingStock, rawNetMap, rawTotalMap, machineHoursMap);
    }
    // Build shopping_list
    const shopping_list = [];
    for (const [itemId, netRequired] of rawNetMap.entries()) {
        const totalNeeded = rawTotalMap.get(itemId) ?? netRequired;
        const itemName = itemNameMap.get(itemId) ?? snakeToTitleCase(itemId);
        shopping_list.push({
            item_id: itemId,
            item_name: itemName,
            total_needed: totalNeeded,
            net_required: netRequired,
        });
    }
    // Also include raw materials that were fully covered by stock
    // (they appear in rawTotalMap but not rawNetMap)
    for (const [itemId, totalNeeded] of rawTotalMap.entries()) {
        if (!rawNetMap.has(itemId)) {
            const itemName = itemNameMap.get(itemId) ?? snakeToTitleCase(itemId);
            shopping_list.push({
                item_id: itemId,
                item_name: itemName,
                total_needed: totalNeeded,
                net_required: 0,
            });
        }
    }
    // Build machine_workloads – only include machines with hours > 0 (Req 4.9)
    const machine_workloads = [];
    for (const [machineId, hoursRequired] of machineHoursMap.entries()) {
        if (hoursRequired <= 0)
            continue;
        const machine = machineMap.get(machineId);
        if (!machine) {
            // Machine not in machines.json – include with placeholder values
            machine_workloads.push({
                machine_id: machineId,
                machine_name: snakeToTitleCase(machineId),
                floor_number: 0,
                hours_required: hoursRequired,
                max_hours_limit: 0,
            });
            continue;
        }
        machine_workloads.push({
            machine_id: machine.machine_id,
            machine_name: machine.machine_name,
            floor_number: machine.floor_number,
            hours_required: hoursRequired,
            max_hours_limit: machine.max_hours_limit,
        });
    }
    return { shopping_list, machine_workloads };
}

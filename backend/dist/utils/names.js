"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateNameError = exports.findNameConflict = exports.normalizeName = void 0;
/**
 * Names are compared without surrounding whitespace or case differences.
 * IDs that belong to recipes are stock references, not raw-material names.
 */
function normalizeName(name) {
    return name.trim().normalize('NFKC').toLocaleLowerCase('th');
}
exports.normalizeName = normalizeName;
function findNameConflict(candidate, { recipes, machines, stocks, excludeRecipeId, excludeMachineId }) {
    const normalized = normalizeName(candidate);
    if (!normalized)
        return undefined;
    const recipe = recipes.find((r) => r.id !== excludeRecipeId && normalizeName(r.name) === normalized);
    if (recipe)
        return { type: 'สินค้า', name: recipe.name };
    const machine = machines.find((m) => m.machine_id !== excludeMachineId && normalizeName(m.machine_name) === normalized);
    if (machine)
        return { type: 'เครื่องจักร', name: machine.machine_name };
    const recipeIds = new Set(recipes.map((r) => r.id));
    const stockName = Object.keys(stocks).find((key) => !recipeIds.has(key) && normalizeName(key) === normalized);
    if (stockName)
        return { type: 'วัตถุดิบ', name: stockName };
}
exports.findNameConflict = findNameConflict;
function duplicateNameError(conflict) {
    return `ชื่อนี้ซ้ำกับ${conflict.type} "${conflict.name}" กรุณาใช้ชื่ออื่น`;
}
exports.duplicateNameError = duplicateNameError;

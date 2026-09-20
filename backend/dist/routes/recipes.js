"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const fileStore_1 = require("../services/fileStore");
const names_1 = require("../utils/names");
const router = (0, express_1.Router)();
/**
 * Migrate stocks and recipe ingredients when a recipe name matches a stock key.
 *
 * When a new recipe is created (or renamed), if its name exactly matches
 * an existing stock key (name-based), we:
 *   1. Move the stock quantity from the old name key → new UUID key
 *   2. Rewrite any ingredient references across all recipes that used the
 *      old name key → new UUID key
 *
 * This ensures "เมล็ดพืชพันธุ์ดี" in stocks and in recipe ingredients
 * all point to the same canonical UUID after the recipe is saved.
 */
async function syncNameToUUID(newId, name, allRecipes, stocks) {
    const trimmedName = name.trim();
    // Check if stocks has a key equal to this name
    if (!Object.prototype.hasOwnProperty.call(stocks, trimmedName)) {
        return { recipes: allRecipes, stocks, migrated: false };
    }
    // 1. Migrate stock key: name → UUID
    const qty = stocks[trimmedName] ?? 0;
    const newStocks = { ...stocks };
    delete newStocks[trimmedName];
    // Merge: if UUID key already existed (shouldn't normally), sum quantities
    newStocks[newId] = (newStocks[newId] ?? 0) + qty;
    // 2. Migrate ingredient references in all recipes: name → UUID
    const newRecipes = allRecipes.map((r) => {
        if (!Object.prototype.hasOwnProperty.call(r.ingredients, trimmedName))
            return r;
        const newIngredients = { ...r.ingredients };
        const existingQty = newIngredients[trimmedName];
        delete newIngredients[trimmedName];
        // Merge if UUID already referenced
        newIngredients[newId] = (newIngredients[newId] ?? 0) + existingQty;
        return { ...r, ingredients: newIngredients };
    });
    return { recipes: newRecipes, stocks: newStocks, migrated: true };
}
/** GET /api/recipes — list all */
router.get('/api/recipes', async (_req, res) => {
    try {
        res.json(await (0, fileStore_1.readRecipes)());
    }
    catch {
        res.status(500).json({ error: 'Failed to read recipes' });
    }
});
/** POST /api/recipes — create new recipe, auto-sync name↔UUID in stocks */
router.post('/api/recipes', async (req, res) => {
    const body = req.body;
    if (!body.name?.trim())
        return res.status(400).json({ error: 'name is required' });
    try {
        const [recipes, stocks, machines] = await Promise.all([(0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)(), (0, fileStore_1.readMachines)()]);
        const conflict = (0, names_1.findNameConflict)(body.name, { recipes, machines, stocks });
        if (conflict)
            return res.status(409).json({ error: (0, names_1.duplicateNameError)(conflict) });
        const newRecipe = {
            id: (0, crypto_1.randomUUID)(),
            name: body.name.trim(),
            machine_id: body.machine_id ?? null,
            time_per_unit: body.time_per_unit ?? null,
            ingredients: body.ingredients ?? {},
        };
        // Add the new recipe first so syncNameToUUID can also patch its own ingredients
        const recipesWithNew = [...recipes, newRecipe];
        // Sync: if this recipe's name matches a stock key, migrate name→UUID
        const { recipes: syncedRecipes, stocks: syncedStocks, migrated } = await syncNameToUUID(newRecipe.id, newRecipe.name, recipesWithNew, stocks);
        await Promise.all([
            (0, fileStore_1.writeRecipes)(syncedRecipes),
            migrated ? (0, fileStore_1.writeStocks)(syncedStocks) : Promise.resolve(),
        ]);
        // Return the final version of the new recipe (ingredients may have been patched)
        const finalRecipe = syncedRecipes.find((r) => r.id === newRecipe.id);
        res.status(201).json({ ...finalRecipe, _synced: migrated });
    }
    catch (err) {
        console.error('POST /api/recipes error:', err);
        res.status(500).json({ error: 'Failed to create recipe' });
    }
});
/** PUT /api/recipes/:id — update recipe, auto-sync name↔UUID */
router.put('/api/recipes/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    try {
        const [recipes, stocks, machines] = await Promise.all([(0, fileStore_1.readRecipes)(), (0, fileStore_1.readStocks)(), (0, fileStore_1.readMachines)()]);
        const idx = recipes.findIndex((r) => r.id === id);
        if (idx === -1)
            return res.status(404).json({ error: `Recipe "${id}" not found` });
        const oldRecipe = recipes[idx];
        const newName = (body.name ?? oldRecipe.name).trim();
        if (!newName)
            return res.status(400).json({ error: 'name is required' });
        const conflict = (0, names_1.findNameConflict)(newName, { recipes, machines, stocks, excludeRecipeId: id });
        if (conflict)
            return res.status(409).json({ error: (0, names_1.duplicateNameError)(conflict) });
        const updated = {
            ...oldRecipe,
            name: newName,
            machine_id: body.machine_id ?? oldRecipe.machine_id,
            time_per_unit: body.time_per_unit !== undefined ? body.time_per_unit : oldRecipe.time_per_unit,
            ingredients: body.ingredients ?? oldRecipe.ingredients,
        };
        const updatedRecipes = [...recipes];
        updatedRecipes[idx] = updated;
        // If name changed and old name was a stock key, rename that stock key → UUID
        let workingStocks = { ...stocks };
        let migrated = false;
        if (newName !== oldRecipe.name) {
            // New name might match a stock key → migrate
            const result = await syncNameToUUID(id, newName, updatedRecipes, workingStocks);
            if (result.migrated) {
                workingStocks = result.stocks;
                migrated = true;
                // Use patched recipes from sync
                updatedRecipes.splice(0, updatedRecipes.length, ...result.recipes);
            }
        }
        // Also: if old name was used as a stock key (and UUID wasn't yet), rename old→UUID
        if (Object.prototype.hasOwnProperty.call(workingStocks, oldRecipe.name)) {
            const qty = workingStocks[oldRecipe.name] ?? 0;
            delete workingStocks[oldRecipe.name];
            workingStocks[id] = (workingStocks[id] ?? 0) + qty;
            migrated = true;
        }
        await Promise.all([
            (0, fileStore_1.writeRecipes)(updatedRecipes),
            migrated ? (0, fileStore_1.writeStocks)(workingStocks) : Promise.resolve(),
        ]);
        const finalRecipe = updatedRecipes.find((r) => r.id === id);
        res.json({ ...finalRecipe, _synced: migrated });
    }
    catch (err) {
        console.error('PUT /api/recipes/:id error:', err);
        res.status(500).json({ error: 'Failed to update recipe' });
    }
});
/** DELETE /api/recipes/:id — remove recipe */
router.delete('/api/recipes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const recipes = await (0, fileStore_1.readRecipes)();
        const filtered = recipes.filter((r) => r.id !== id);
        if (filtered.length === recipes.length) {
            return res.status(404).json({ error: `Recipe "${id}" not found` });
        }
        await (0, fileStore_1.writeRecipes)(filtered);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Failed to delete recipe' });
    }
});
exports.default = router;

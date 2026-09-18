/**
 * migrator.ts
 *
 * Auto-migration: ensures all recipe names that appear as string keys
 * in stocks.json or in recipe ingredients are replaced with the recipe's UUID.
 *
 * Run order:
 *   1. Build a map of  name → UUID  from recipes.json
 *   2. Fix stocks.json  — rename any name-key that matches a recipe → UUID key
 *   3. Fix recipes.json — rename any ingredient name-key that matches a recipe → UUID key
 *
 * Idempotent: running multiple times produces the same result.
 */

import { readRecipes, readStocks, writeRecipes, writeStocks } from './fileStore';
import { Recipe, StockMap } from '../types';

export interface MigrationReport {
  stocksFixed: string[];       // names that were migrated in stocks
  ingredientsFixed: string[];  // "recipeName.ingredientName" that were migrated
  totalChanges: number;
}

export async function runMigration(): Promise<MigrationReport> {
  const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);

  // Build name → UUID lookup (case-sensitive exact match)
  const nameToId = new Map<string, string>();
  for (const r of recipes) {
    nameToId.set(r.name.trim(), r.id);
  }

  const stocksFixed: string[] = [];
  const ingredientsFixed: string[] = [];

  // ── 1. Fix stocks ────────────────────────────────────────────────────────────
  let newStocks: StockMap = {};
  for (const [key, qty] of Object.entries(stocks)) {
    const uuid = nameToId.get(key);
    if (uuid && uuid !== key) {
      // This stock key is a recipe name — migrate to UUID
      // Merge if UUID already exists in stocks
      newStocks[uuid] = (newStocks[uuid] ?? 0) + qty;
      stocksFixed.push(key);
    } else {
      // Keep as-is (raw material or already a UUID)
      newStocks[key] = (newStocks[key] ?? 0) + qty;
    }
  }

  // ── 2. Fix recipe ingredients ─────────────────────────────────────────────────
  let recipesChanged = false;
  const newRecipes: Recipe[] = recipes.map((recipe) => {
    const newIngredients: Record<string, number> = {};
    let changed = false;

    for (const [key, qty] of Object.entries(recipe.ingredients)) {
      const uuid = nameToId.get(key);
      if (uuid && uuid !== key) {
        // ingredient key is a recipe name — migrate to UUID
        // Merge if UUID already referenced
        newIngredients[uuid] = (newIngredients[uuid] ?? 0) + qty;
        ingredientsFixed.push(`${recipe.name} → ingredient "${key}"`);
        changed = true;
      } else {
        newIngredients[key] = (newIngredients[key] ?? 0) + qty;
      }
    }

    if (changed) {
      recipesChanged = true;
      return { ...recipe, ingredients: newIngredients };
    }
    return recipe;
  });

  // ── 3. Write only if changed ──────────────────────────────────────────────────
  const stocksChanged = stocksFixed.length > 0;
  await Promise.all([
    stocksChanged ? writeStocks(newStocks) : Promise.resolve(),
    recipesChanged ? writeRecipes(newRecipes) : Promise.resolve(),
  ]);

  const totalChanges = stocksFixed.length + ingredientsFixed.length;

  if (totalChanges > 0) {
    console.log(`[Migration] Fixed ${stocksFixed.length} stock keys, ${ingredientsFixed.length} ingredient refs`);
    if (stocksFixed.length) console.log(`  Stocks: ${stocksFixed.join(', ')}`);
    if (ingredientsFixed.length) console.log(`  Ingredients:\n    ${ingredientsFixed.join('\n    ')}`);
  } else {
    console.log('[Migration] No conflicts found — data is clean');
  }

  return { stocksFixed, ingredientsFixed, totalChanges };
}

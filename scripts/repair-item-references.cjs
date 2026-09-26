// Run with a historical API snapshot containing itemNames. Dry-run by default.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local', quiet: true });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const normalize = (name) => name.trim().normalize('NFKC').toLocaleLowerCase('th');
async function read(table) {
  const { data, error } = await db.from(table).select('*');
  if (error) throw error;
  return data;
}
async function main() {
  const historicalNames = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const [items, recipes, stocks, purchases] = await Promise.all([
    read('items'), read('recipes'), read('stocks'), read('stock_purchases'),
  ]);
  const byId = new Map(items.map(item => [item.item_id, item]));
  const byName = new Map();
  for (const item of items) {
    const name = normalize(item.name);
    byName.set(name, [...(byName.get(name) || []), item.item_id]);
  }
  const patches = [];
  const unresolved = new Set();
  for (const recipe of recipes) {
    const ingredients = {};
    for (const [id, qty] of Object.entries(recipe.ingredients || {})) {
      let target = id;
      if (!byId.has(id)) {
        const name = historicalNames[id];
        const candidates = name ? byName.get(normalize(name)) : [];
        if (candidates?.length !== 1) unresolved.add(id);
        else target = candidates[0];
      }
      ingredients[target] = (ingredients[target] || 0) + qty;
    }
    if (JSON.stringify(ingredients) !== JSON.stringify(recipe.ingredients)) patches.push({ recipe, ingredients });
  }
  console.log(JSON.stringify({ items: items.length, recipes: recipes.length, affectedRecipes: patches.length,
    unresolved: [...unresolved], duplicateNames: [...byName.values()].filter(ids => ids.length > 1).length }));
  if (unresolved.size) throw new Error('Unresolved references; no writes performed');
  if (!process.argv.includes('--apply')) return;
  const backup = `/tmp/pixels-before-reference-repair-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify({ items, recipes, stocks, purchases }), { mode: 0o600 });
  console.log(`Backup: ${backup}`);
  for (const { recipe, ingredients } of patches) {
    // Compare-and-set protects any recipe edited after this snapshot.
    const { data, error } = await db.from('recipes').update({ ingredients })
      .eq('id', recipe.id).eq('ingredients', JSON.stringify(recipe.ingredients)).select('id');
    if (error) throw error;
    if (data.length !== 1) throw new Error(`Concurrent edit: ${recipe.id}`);
  }
  const finalRecipes = await read('recipes');
  const missing = finalRecipes.flatMap(r => Object.keys(r.ingredients || {}).filter(id => !byId.has(id)));
  if (missing.length) throw new Error(`Remaining missing references: ${missing.length}`);
  console.log(JSON.stringify({ repairedRecipes: patches.length, missingReferences: missing.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

/** Repair the verified legacy ยาเพิ่มสมาธิ ingredient reference.
 * Dry run: npx tsx scripts/repair-concentration-reference.ts
 * Apply:   npx tsx scripts/repair-concentration-reference.ts --apply
 * Uses optimistic concurrency so another editor's changes are never overwritten.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const oldId = 'b5832ff1-c629-4e24-96bc-71868663eee6';
const newId = 'e91db6d3-2141-4e18-8feb-cf05e8f1a1d8';

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: recipes, error } = await db.from('recipes').select('id, name, ingredients');
  if (error) throw new Error(error.message);
  if (recipes.some((r) => r.id === oldId) ||
      !recipes.some((r) => r.id === newId && r.name === 'ยาเพิ่มสมาธิ')) {
    throw new Error('Recipe identity has changed; manual review is required.');
  }
  for (const recipe of recipes) {
    const ingredients = recipe.ingredients as Record<string, number>;
    if (!Object.hasOwn(ingredients, oldId)) continue;
    const next = { ...ingredients, [newId]: (ingredients[newId] ?? 0) + ingredients[oldId] };
    delete next[oldId];
    if (process.argv.includes('--apply')) {
      const { data, error: updateError } = await db.from('recipes')
        .update({ ingredients: next }).eq('id', recipe.id)
        .eq('ingredients', JSON.stringify(ingredients)).select('id');
      if (updateError) throw new Error(updateError.message);
      if (data.length !== 1) throw new Error('Recipe changed concurrently; rerun after review.');
    }
    console.log(`${process.argv.includes('--apply') ? 'Repaired' : 'Would repair'}: ${recipe.name}`);
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

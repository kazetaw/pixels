/**
 * api/migrate.ts  →  POST /api/migrate
 * Run data migration: fix all name/UUID conflicts in Supabase.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRecipes, readStocks, getSupabase } from './lib/db.js';
import { applyCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);
    const db = getSupabase();

    const nameToId = new Map<string, string>();
    for (const r of recipes) nameToId.set(r.name.trim(), r.id);

    const stocksFixed: string[] = [];
    const ingredientsFixed: string[] = [];

    // ── Fix stocks ────────────────────────────────────────────────────────────
    for (const [key, qty] of Object.entries(stocks)) {
      const uuid = nameToId.get(key);
      if (uuid && uuid !== key) {
        await db.from('stocks').delete().eq('item_id', key);
        await db
          .from('stocks')
          .upsert({ item_id: uuid, quantity: qty }, { onConflict: 'item_id' });
        stocksFixed.push(key);
      }
    }

    // ── Fix recipe ingredients ─────────────────────────────────────────────────
    for (const recipe of recipes) {
      let changed = false;
      const newIngredients: Record<string, number> = {};

      for (const [key, qty] of Object.entries(recipe.ingredients)) {
        const uuid = nameToId.get(key);
        if (uuid && uuid !== key) {
          newIngredients[uuid] = (newIngredients[uuid] ?? 0) + qty;
          ingredientsFixed.push(`${recipe.name} → ingredient "${key}"`);
          changed = true;
        } else {
          newIngredients[key] = (newIngredients[key] ?? 0) + qty;
        }
      }

      if (changed) {
        await db
          .from('recipes')
          .update({ ingredients: newIngredients })
          .eq('id', recipe.id);
      }
    }

    const totalChanges = stocksFixed.length + ingredientsFixed.length;

    res.json({
      ok: true,
      message:
        totalChanges > 0
          ? `แก้ไข ${stocksFixed.length} stock keys และ ${ingredientsFixed.length} ingredient refs`
          : 'ไม่พบ conflict — ข้อมูลสะอาดแล้ว',
      report: { stocksFixed, ingredientsFixed, totalChanges },
    });
  } catch (err) {
    console.error('POST /api/migrate error:', err);
    res.status(500).json({ error: 'Migration failed' });
  }
}

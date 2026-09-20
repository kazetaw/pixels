/**
 * api/diagnose.ts  →  GET /api/diagnose
 * Scan for name/UUID conflicts without fixing anything.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRecipes, readStocks } from './lib/db.js';
import { applyCors } from './lib/cors.js';

export interface ConflictItem {
  type: 'stock_key' | 'ingredient_ref';
  description: string;
  currentKey: string;
  targetUUID: string;
  recipeName: string;
  currentQty?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);
    const nameToId = new Map<string, string>(recipes.map((r) => [r.name.trim(), r.id]));
    const conflicts: ConflictItem[] = [];

    for (const [key, qty] of Object.entries(stocks)) {
      const uuid = nameToId.get(key);
      if (uuid && uuid !== key) {
        conflicts.push({
          type: 'stock_key',
          description: `สต็อก "${key}" ควรใช้ UUID ของ recipe "${key}"`,
          currentKey: key,
          targetUUID: uuid,
          recipeName: 'สต็อก',
          currentQty: qty,
        });
      }
    }

    for (const recipe of recipes) {
      for (const [key, qty] of Object.entries(recipe.ingredients)) {
        const uuid = nameToId.get(key);
        if (uuid && uuid !== key) {
          conflicts.push({
            type: 'ingredient_ref',
            description: `Recipe "${recipe.name}" → ingredient "${key}" ควรใช้ UUID`,
            currentKey: key,
            targetUUID: uuid,
            recipeName: recipe.name,
            currentQty: qty,
          });
        }
      }
    }

    res.json({ conflicts, totalConflicts: conflicts.length, isClean: conflicts.length === 0 });
  } catch (err) {
    console.error('GET /api/diagnose error:', err);
    res.status(500).json({ error: 'Diagnose failed' });
  }
}

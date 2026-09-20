/**
 * api/calculate.ts  →  POST /api/calculate
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRecipes, readMachines, readStocks } from './lib/db.js';
import { calculate } from './lib/bomCalculator.js';
import type { TargetItem } from './lib/types.js';
import { applyCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;

  if (!Array.isArray(body) || body.length === 0)
    return res.status(400).json({ error: 'Request body must be a non-empty array of target items' });

  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (!item || typeof item !== 'object')
      return res.status(400).json({ error: `Item at index ${i} must be an object` });
    if (typeof item.target_item_id !== 'string' || !item.target_item_id.trim())
      return res.status(400).json({ error: `Item at index ${i} is missing a valid target_item_id` });
    if (typeof item.target_quantity !== 'number' || item.target_quantity <= 0)
      return res.status(400).json({ error: `Item at index ${i} must have a positive target_quantity` });
  }

  try {
    const [recipes, machines, stocks] = await Promise.all([
      readRecipes(),
      readMachines(),
      readStocks(),
    ]);

    // Build set of all known item IDs
    const allKnownItems = new Set<string>();
    for (const recipe of recipes) {
      allKnownItems.add(recipe.id);
      for (const ingredientId of Object.keys(recipe.ingredients)) {
        allKnownItems.add(ingredientId);
      }
    }

    for (const item of body as TargetItem[]) {
      if (!allKnownItems.has(item.target_item_id))
        return res.status(400).json({
          error: `Unknown target_item_id: "${item.target_item_id}". Item not found in any recipe.`,
        });
    }

    const result = calculate(body as TargetItem[], recipes, machines, stocks);
    res.json(result);
  } catch (err) {
    console.error('POST /api/calculate error:', err);
    res.status(500).json({ error: 'Calculation failed' });
  }
}

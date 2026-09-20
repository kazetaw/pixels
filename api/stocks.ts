/**
 * api/stocks.ts  →  POST /api/stocks  |  GET /api/stock-images
 *
 * POST /api/stocks   — overwrite stocks (and optionally stock_images)
 * GET  /api/stock-images — return current stock image map
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  readRecipes,
  readMachines,
  readStockImages,
  writeStocks,
  writeStockImages,
} from './lib/db.js';
import { findNameConflict, duplicateNameError, normalizeName } from './lib/names.js';
import type { StockMap, StockImageMap } from './lib/types.js';
import { applyCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  // ── GET /api/stock-images ──────────────────────────────────────────────────
  // Vercel routes this file for both /api/stocks and /api/stock-images
  // because the file is named stocks.ts — we handle the path manually.
  if (req.method === 'GET') {
    try {
      res.json(await readStockImages());
    } catch (err) {
      console.error('GET /api/stock-images error:', err);
      res.status(500).json({ error: 'Failed to read stock images' });
    }
    return;
  }

  // ── POST /api/stocks ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body))
      return res.status(400).json({ error: 'Request body must be an object' });

    // Support both legacy flat format { key: qty } and new { stocks, images }
    let stockMap: StockMap;
    let imageMap: StockImageMap | undefined;

    if (body.stocks !== undefined) {
      stockMap = body.stocks as StockMap;
      imageMap = body.images as StockImageMap | undefined;
    } else {
      stockMap = body as StockMap;
    }

    // Validate all values are numbers
    for (const [key, value] of Object.entries(stockMap)) {
      if (typeof value !== 'number')
        return res.status(400).json({ error: `Invalid value for item "${key}": expected a number` });
    }

    try {
      const [recipes, machines] = await Promise.all([readRecipes(), readMachines()]);
      const recipeIds = new Set(recipes.map((r) => r.id));
      const rawNames = new Map<string, string>();

      for (const key of Object.keys(stockMap)) {
        if (recipeIds.has(key)) continue; // recipe UUID — skip name checks
        const normalized = normalizeName(key);
        if (!normalized) return res.status(400).json({ error: 'ชื่อวัตถุดิบต้องไม่ว่าง' });
        const duplicate = rawNames.get(normalized);
        if (duplicate)
          return res.status(409).json({ error: `ชื่อวัตถุดิบซ้ำ: "${duplicate}" และ "${key}"` });
        rawNames.set(normalized, key);
        const conflict = findNameConflict(key, { recipes, machines, stocks: {} });
        if (conflict) return res.status(409).json({ error: duplicateNameError(conflict) });
      }

      if (imageMap !== undefined) {
        await Promise.all([writeStocks(stockMap), writeStockImages(imageMap)]);
      } else {
        await writeStocks(stockMap);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('POST /api/stocks error:', err);
      res.status(500).json({ error: 'Failed to write stocks' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

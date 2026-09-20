import { Router, Request, Response } from 'express';
import { writeStocks, writeStockImages, readStockImages } from '../services/fileStore';
import { StockMap, StockImageMap } from '../types';

const router = Router();

/**
 * POST /api/stocks
 * Body: { stocks: StockMap, images?: StockImageMap }
 * Overwrites stocks.json (and optionally stock_images.json).
 */
router.post('/api/stocks', async (req: Request, res: Response) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be an object' });
  }

  // Support both legacy format { key: qty, ... } and new format { stocks: {...}, images: {...} }
  let stockMap: StockMap;
  let imageMap: StockImageMap | undefined;

  if (body.stocks !== undefined) {
    // New format
    stockMap = body.stocks as StockMap;
    imageMap = body.images as StockImageMap | undefined;
  } else {
    // Legacy format — plain StockMap
    stockMap = body as StockMap;
  }

  // Validate stock values are numbers
  for (const [key, value] of Object.entries(stockMap)) {
    if (typeof value !== 'number') {
      return res.status(400).json({ error: `Invalid value for item "${key}": expected a number` });
    }
  }

  try {
    if (imageMap) {
      await Promise.all([writeStocks(stockMap), writeStockImages(imageMap)]);
    } else {
      await writeStocks(stockMap);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/stocks error:', err);
    res.status(500).json({ error: 'Failed to write stocks file' });
  }
});

/**
 * GET /api/stock-images
 * Returns the current stock image map.
 */
router.get('/api/stock-images', async (_req: Request, res: Response) => {
  try {
    res.json(await readStockImages());
  } catch (err) {
    console.error('GET /api/stock-images error:', err);
    res.status(500).json({ error: 'Failed to read stock images' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { writeStocks } from '../services/fileStore';
import { StockMap } from '../types';

const router = Router();

/**
 * POST /api/stocks
 * Overwrites stocks.json with the provided stock map.
 * Body: StockMap (key-value object of item_id -> quantity)
 * Requirements: 3.1, 3.2, 3.3
 */
router.post('/api/stocks', async (req: Request, res: Response) => {
  const body = req.body;

  // Validate: must be a non-null, non-array object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a stocks map object (key-value pairs of item_id to quantity)' });
  }

  // Validate: all values must be numbers
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'number') {
      return res.status(400).json({ error: `Invalid value for item "${key}": expected a number, got ${typeof value}` });
    }
  }

  try {
    await writeStocks(body as StockMap);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/stocks error:', err);
    res.status(500).json({ error: 'Failed to write stocks file' });
  }
});

export default router;

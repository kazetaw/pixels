/**
 * api/stock-images.ts  →  GET /api/stock-images
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readStockImages } from './lib/db.js';
import { applyCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    res.json(await readStockImages());
  } catch (err) {
    console.error('GET /api/stock-images error:', err);
    res.status(500).json({ error: 'Failed to read stock images' });
  }
}

import { Router, Request, Response } from 'express';
import { readRecipes, readMachines, readStocks } from '../services/fileStore';

const router = Router();

/**
 * GET /api/data
 * Returns all recipes, machines, and stocks in a single payload.
 * Requirements: 2.1, 2.2, 2.3
 */
router.get('/api/data', async (_req: Request, res: Response) => {
  try {
    const [recipes, machines, stocks] = await Promise.all([
      readRecipes(),
      readMachines(),
      readStocks(),
    ]);
    res.json({ recipes, machines, stocks });
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to read data files' });
  }
});

export default router;

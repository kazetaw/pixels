import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { Budget, Currency, StockPurchase } from '../types';
import { readBudgets, readStockPurchases, readStocks, writeBudgets, writeStockPurchases, writeStocks } from '../services/fileStore';

const router = Router();

function isCurrency(value: unknown): value is Currency {
  return value === 'THB' || value === 'G';
}

router.get('/api/budgets', async (_req: Request, res: Response) => {
  try {
    const [budgets, purchases] = await Promise.all([readBudgets(), readStockPurchases()]);
    res.json({ budgets, purchases: purchases.sort((a, b) => b.purchased_at.localeCompare(a.purchased_at)).slice(0, 100) });
  } catch (err) {
    console.error('GET /api/budgets error:', err);
    res.status(500).json({ error: 'Failed to read budgets' });
  }
});

router.put('/api/budgets', async (req: Request, res: Response) => {
  const body = req.body as Partial<Budget>;
  if (!isCurrency(body.currency) || typeof body.limit_amount !== 'number' || body.limit_amount < 0)
    return res.status(400).json({ error: 'currency must be THB or G and limit_amount must be non-negative' });
  try {
    const budgets = await readBudgets();
    const budget: Budget = { currency: body.currency, limit_amount: body.limit_amount };
    await writeBudgets([...budgets.filter((entry) => entry.currency !== body.currency), budget]);
    res.json(budget);
  } catch (err) {
    console.error('PUT /api/budgets error:', err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

router.post('/api/purchases', async (req: Request, res: Response) => {
  const body = req.body as Partial<StockPurchase>;
  if (!body.item_id?.trim() || typeof body.quantity !== 'number' || !Number.isInteger(body.quantity) || body.quantity <= 0 || typeof body.total_amount !== 'number' || body.total_amount < 0 || !isCurrency(body.currency))
    return res.status(400).json({ error: 'item_id, a positive integer quantity, non-negative total_amount, and THB or G currency are required' });
  try {
    const [budgets, purchases, stocks] = await Promise.all([readBudgets(), readStockPurchases(), readStocks()]);
    const limit = budgets.find((budget) => budget.currency === body.currency)?.limit_amount;
    const spent = purchases.filter((purchase) => purchase.currency === body.currency).reduce((sum, purchase) => sum + purchase.total_amount, 0);
    if (limit !== undefined && spent + body.total_amount > limit)
      return res.status(409).json({ error: `Budget exceeded for ${body.currency}` });

    const purchase: StockPurchase = {
      id: randomUUID(), item_id: body.item_id.trim(), quantity: body.quantity,
      total_amount: body.total_amount, currency: body.currency,
      ...(body.source?.trim() && { source: body.source.trim() }),
      ...(body.contributor?.trim() && { contributor: body.contributor.trim() }),
      purchased_at: new Date().toISOString(),
    };
    const nextStocks = { ...stocks, [purchase.item_id]: (stocks[purchase.item_id] ?? 0) + purchase.quantity };
    await Promise.all([writeStockPurchases([purchase, ...purchases]), writeStocks(nextStocks)]);
    res.status(201).json(purchase);
  } catch (err) {
    console.error('POST /api/purchases error:', err);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

export default router;

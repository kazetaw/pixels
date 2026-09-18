import { Router, Request, Response } from 'express';
import { readRecipes, readStocks } from '../services/fileStore';
import { runMigration } from '../services/migrator';

const router = Router();

export interface ConflictItem {
  type: 'stock_key' | 'ingredient_ref';
  description: string;         // human-readable
  currentKey: string;          // the name-string that should become UUID
  targetUUID: string;          // the UUID it should point to
  recipeName: string;          // recipe it belongs to (or "สต็อก" for stock)
  currentQty?: number;
}

export interface DiagnoseResult {
  conflicts: ConflictItem[];
  totalConflicts: number;
  isClean: boolean;
}

/** GET /api/diagnose — scan and report conflicts without fixing anything */
router.get('/api/diagnose', async (_req: Request, res: Response) => {
  try {
    const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);

    const nameToId = new Map<string, string>(recipes.map((r) => [r.name.trim(), r.id]));
    const conflicts: ConflictItem[] = [];

    // 1. Stock keys that are recipe names (should be UUIDs)
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

    // 2. Ingredient keys that are recipe names (should be UUIDs)
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

    const result: DiagnoseResult = {
      conflicts,
      totalConflicts: conflicts.length,
      isClean: conflicts.length === 0,
    };

    res.json(result);
  } catch (err) {
    console.error('GET /api/diagnose error:', err);
    res.status(500).json({ error: 'Diagnose failed' });
  }
});

/** POST /api/migrate — run migration (fix all conflicts) */
router.post('/api/migrate', async (_req: Request, res: Response) => {
  try {
    const report = await runMigration();
    res.json({
      ok: true,
      message: report.totalChanges > 0
        ? `แก้ไข ${report.stocksFixed.length} stock keys และ ${report.ingredientsFixed.length} ingredient refs`
        : 'ไม่พบ conflict — ข้อมูลสะอาดแล้ว',
      report,
    });
  } catch (err) {
    console.error('POST /api/migrate error:', err);
    res.status(500).json({ error: 'Migration failed' });
  }
});

export default router;

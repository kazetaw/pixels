import { Router, Request, Response } from 'express';
import { runMigration } from '../services/migrator';

const router = Router();

/**
 * POST /api/migrate
 * Trigger migration manually from the frontend or CLI.
 * Also called automatically at server startup.
 */
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
    console.error('Migration error:', err);
    res.status(500).json({ error: 'Migration failed' });
  }
});

export default router;

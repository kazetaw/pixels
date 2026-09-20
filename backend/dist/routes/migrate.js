"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const migrator_1 = require("../services/migrator");
const router = (0, express_1.Router)();
/**
 * POST /api/migrate
 * Trigger migration manually from the frontend or CLI.
 * Also called automatically at server startup.
 */
router.post('/api/migrate', async (_req, res) => {
    try {
        const report = await (0, migrator_1.runMigration)();
        res.json({
            ok: true,
            message: report.totalChanges > 0
                ? `แก้ไข ${report.stocksFixed.length} stock keys และ ${report.ingredientsFixed.length} ingredient refs`
                : 'ไม่พบ conflict — ข้อมูลสะอาดแล้ว',
            report,
        });
    }
    catch (err) {
        console.error('Migration error:', err);
        res.status(500).json({ error: 'Migration failed' });
    }
});
exports.default = router;

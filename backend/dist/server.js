"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const data_1 = __importDefault(require("./routes/data"));
const stocks_1 = __importDefault(require("./routes/stocks"));
const calculate_1 = __importDefault(require("./routes/calculate"));
const plan_1 = __importDefault(require("./routes/plan"));
const recipes_1 = __importDefault(require("./routes/recipes"));
const diagnose_1 = __importDefault(require("./routes/diagnose"));
const machines_1 = __importDefault(require("./routes/machines"));
const migrator_1 = require("./services/migrator");
const app = (0, express_1.default)();
const PORT = 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use(data_1.default);
app.use(stocks_1.default);
app.use(calculate_1.default);
app.use(plan_1.default);
app.use(recipes_1.default);
app.use(diagnose_1.default);
app.use(machines_1.default);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Start server + run auto-migration on startup
app.listen(PORT, async () => {
    console.log(`Factory Resource Calculator backend running on http://localhost:${PORT}`);
    console.log('[Migration] Scanning for name/UUID conflicts...');
    try {
        await (0, migrator_1.runMigration)();
    }
    catch (err) {
        console.error('[Migration] Failed:', err);
    }
});
exports.default = app;

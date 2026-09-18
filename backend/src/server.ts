import express from 'express';
import cors from 'cors';
import dataRouter from './routes/data';
import stocksRouter from './routes/stocks';
import calculateRouter from './routes/calculate';
import planRouter from './routes/plan';
import recipesRouter from './routes/recipes';
import diagnoseRouter from './routes/diagnose';
import { runMigration } from './services/migrator';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(dataRouter);
app.use(stocksRouter);
app.use(calculateRouter);
app.use(planRouter);
app.use(recipesRouter);
app.use(diagnoseRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Start server + run auto-migration on startup
app.listen(PORT, async () => {
  console.log(`Factory Resource Calculator backend running on http://localhost:${PORT}`);
  console.log('[Migration] Scanning for name/UUID conflicts...');
  try {
    await runMigration();
  } catch (err) {
    console.error('[Migration] Failed:', err);
  }
});

export default app;

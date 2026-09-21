/**
 * dev-server.ts
 *
 * Local development server — wraps all api/index.ts routes in Express.
 * Run with:  npx tsx dev-server.ts
 *
 * Reads .env.local automatically via dotenv.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, fallback to .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Dynamic import so TypeScript module resolution works at runtime
async function start() {
  const { default: handler } = await import('./api/index.js');

  const app = express();
  app.use(cors());
  // Large limit for image uploads
  app.use(express.json({ limit: '10mb' }));

  // Mount the single catch-all handler at /api/*
  app.all('/api/{*path}', async (req, res) => {
    await handler(req as any, res as any);
  });

  // Static fallback (not needed in dev — Vite handles frontend)
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const PORT = process.env.API_PORT ?? 3001;
  createServer(app).listen(PORT, () => {
    console.log(`\n✅  Dev API server running at http://localhost:${PORT}`);
    console.log(`   Supabase URL: ${process.env.SUPABASE_URL ? '✓ set' : '✗ MISSING'}\n`);
  });
}

start().catch((e) => { console.error(e); process.exit(1); });

/**
 * api/lib/cors.ts
 * CORS helper for Vercel Functions — applies headers and handles preflight.
 * Returns true if the request was a preflight and the response is already sent.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // preflight handled
  }
  return false;
}

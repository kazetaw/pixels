import { createHash, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './db.js';

type WebPushModule = {
  sendNotification: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, options?: object) => Promise<unknown>;
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
};

async function getWebPush(): Promise<WebPushModule> {
  return await import('web-push') as unknown as WebPushModule;
}

export function pushConfigured() {
  return Boolean(process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT && process.env.CRON_SECRET);
}
export function validateSubscription(value: any): { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) throw new Error('ข้อมูลอุปกรณ์ไม่ถูกต้อง');
  const url = new URL(value.endpoint);
  // Push endpoints are capabilities, not arbitrary URLs: avoid server-side request forgery.
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname === 'web.push.apple.com';
  if (url.protocol !== 'https:' || !allowed || url.port || url.username || url.password || url.hash) throw new Error('บริการแจ้งเตือนนี้ยังไม่รองรับ');
  const key = value.keys?.p256dh, auth = value.keys?.auth;
  if (typeof key !== 'string' || typeof auth !== 'string' || !/^[\w-]+$/.test(key) || !/^[\w-]+$/.test(auth) || Buffer.from(key, 'base64url').length !== 65 || Buffer.from(auth, 'base64url').length !== 16) throw new Error('กุญแจแจ้งเตือนไม่ถูกต้อง');
  return { endpoint: url.href, keys: { p256dh: key, auth } };
}
export function authorizedCron(header: unknown, secret = process.env.CRON_SECRET) {
  if (!secret || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function externalPushAccount(req: VercelRequest, res: VercelResponse, owner: string, sessionHash: string) {
  const db = getSupabase();
  if (req.method === 'GET') {
    const { error } = await db.from('external_push_subscriptions').select('id').limit(0);
    return res.json({ available: pushConfigured() && !error, publicKey: process.env.WEB_PUSH_PUBLIC_KEY ?? null });
  }
  if (req.method === 'DELETE') {
    if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ error: 'ไม่พบอุปกรณ์' });
    const { error } = await db.from('external_push_subscriptions').delete().eq('owner_id', owner).eq('endpoint', req.body.endpoint);
    if (error) throw error;
    return res.json({ ok: true });
  }
  // Explicit status lookup avoids showing a stale browser subscription as enabled.
  if (req.method === 'POST' && req.body?.action === 'status') {
    const { data, error } = await db.from('external_push_subscriptions').select('id').eq('owner_id', owner).eq('session_hash', sessionHash).eq('endpoint', String(req.body.endpoint)).maybeSingle();
    if (error) throw error;
    return res.json({ enabled: Boolean(data) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!pushConfigured()) return res.status(503).json({ error: 'ระบบแจ้งเตือนยังไม่ได้ตั้งค่า' });
  const subscription = validateSubscription(req.body?.subscription);
  const webpush = await getWebPush();
  const { error } = await db.from('external_push_subscriptions').upsert({ owner_id: owner, session_hash: sessionHash, endpoint: subscription.endpoint, subscription }, { onConflict: 'endpoint' });
  if (error) throw error;
  return res.json({ enabled: true });
}
export function notificationPayload(row: any) {
  const name = String(row.timer_data.name || 'เครื่องนอก').slice(0, 120);
  const character = String(row.timer_data.character_name || '').slice(0, 80);
  return {
    title: `${name} ผลิตเสร็จแล้ว`,
    body: `${character ? `${character} · ` : ''}เสร็จ ${new Date(row.due_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', minute: '2-digit' })} · กลับมาเก็บก่อนลอย`,
    tag: `external-${row.timer_id}-${createHash('sha256').update(row.run_start).digest('hex').slice(0, 12)}`,
    url: `/?externalTimer=${row.timer_id}`,
  };
}
export async function externalPushDispatch(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!authorizedCron(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' });
  if (!pushConfigured()) return res.status(503).json({ error: 'Push not configured' });
  const db = getSupabase();
  try {
    const { data: jobs, error } = await db.rpc('external_push_claim');
    if (error) throw error;
    let sent = 0, failed = 0;
    // Bounded batches keep runtime and provider traffic predictable.
    for (let i = 0; i < (jobs ?? []).length; i += 10) {
      await Promise.all(jobs.slice(i, i + 10).map(async (row: any) => {
        // Recheck reset/logout/unsubscribe after claim, immediately before sending.
        const { data: live, error: liveError } = await db.from('external_push_deliveries').select('id').eq('id', row.delivery_id).is('sent_at', null).maybeSingle();
        if (liveError) throw liveError;
        if (!live) return;
        try {
          const webpush = await getWebPush();
          await webpush.sendNotification(validateSubscription(row.subscription), JSON.stringify(notificationPayload(row)), {
            TTL: 900, urgency: 'high', timeout: 8000,
            vapidDetails: { subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
          });
          const { error } = await db.from('external_push_deliveries').update({ sent_at: new Date().toISOString(), lease_until: null }).eq('id', row.delivery_id);
          if (error) throw error;
          sent++;
        } catch (e) {
          failed++;
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            const { error } = await db.from('external_push_subscriptions').delete().eq('id', row.subscription_id);
            if (error) throw error;
          } else {
            const { error } = await db.from('external_push_deliveries').update({ lease_until: null, next_attempt_at: new Date(Date.now() + Math.min(300, 30 * 2 ** row.attempts) * 1000).toISOString() }).eq('id', row.delivery_id);
            if (error) throw error;
            console.error('External push delivery failed', status ?? 'transport', (e as Error).message?.slice(0, 200));
          }
        }
      }));
    }
    return res.json({ claimed: jobs?.length ?? 0, sent, failed });
  } catch (e) {
    console.error('External push dispatcher failed', (e as { code?: string }).code ?? 'internal');
    return res.status(503).json({ error: 'Push dispatcher unavailable' });
  }
}

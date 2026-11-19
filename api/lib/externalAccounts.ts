import { externalPushAccount } from './externalPush.js';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './db.js';
const COOKIE = 'pixel_external_session';
export const SESSION_SECONDS = 90 * 86400;
const DAYS = SESSION_SECONDS;
export const shouldRenewSession = (expiresAt: string, now = Date.now()) =>
  Date.parse(expiresAt) > now && Date.parse(expiresAt) - now < 83 * 86400 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const actual = await derive(password, salt);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function normalizeUsername(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.-]{3,32}$/.test(value.trim())) throw new Error('ชื่อผู้ใช้ 3–32 ตัว ใช้ a-z, 0-9, จุด ขีดกลาง หรือขีดล่าง');
  return value.trim().toLowerCase();
}
export function validateTimer(input: any, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('ข้อมูลเครื่องนอกไม่ถูกต้อง');
  const data: Record<string, any> = {};
  for (const field of ['name', 'character_name', 'profession', 'machine_id', 'recipe_id']) {
    if (input[field] !== undefined) {
      if (input[field] !== null && (typeof input[field] !== 'string' || input[field].length > 200)) throw new Error(`ข้อมูล ${field} ไม่ถูกต้อง`);
      data[field] = typeof input[field] === 'string' ? input[field].trim() : null;
    }
  }
  if ((!partial || input.name !== undefined) && (!data.name || data.name.length > 120)) throw new Error('กรอกชื่อเครื่องนอกไม่เกิน 120 ตัวอักษร');
  if (input.status !== undefined && !['idle', 'running'].includes(input.status)) throw new Error('สถานะไม่ถูกต้อง');
  if (input.status !== undefined) data.status = input.status;
  if (input.estimated_duration_seconds !== undefined) {
    if (!Number.isInteger(input.estimated_duration_seconds) || input.estimated_duration_seconds < 0 || input.estimated_duration_seconds > 2147483647) throw new Error('ระยะเวลาไม่ถูกต้อง');
    data.estimated_duration_seconds = input.estimated_duration_seconds;
  }
  for (const field of ['start_time', 'completed_at']) {
    if (input[field] !== undefined) {
      if (input[field] !== null && (typeof input[field] !== 'string' || !Number.isFinite(Date.parse(input[field])))) throw new Error('เวลาไม่ถูกต้อง');
      data[field] = input[field];
    }
  }
  if (!partial) {
    data.status ??= 'idle'; data.estimated_duration_seconds ??= 0;
    data.start_time ??= null; data.completed_at ??= null;
    data.machine_id ??= null; data.recipe_id ??= null;
    if (data.status === 'running' && (!data.start_time || data.estimated_duration_seconds <= 0)) throw new Error('ข้อมูลเวลาที่กำลังทำงานไม่ครบ');
  }
  return data;
}
function cookie(res: VercelResponse, token: string, seconds = DAYS) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api/external-account; Max-Age=${seconds}${process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
const tokenFrom = (req: VercelRequest) => (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
const serialize = (row: any) => ({ ...row.data, floor_number: Number(row.id) });
export async function externalAccountHandler(req: VercelRequest, res: VercelResponse, segments: string[]) {
  res.setHeader('Cache-Control', 'no-store');
  // Cookie-authenticated writes are same-origin JSON requests only.
  if (req.method !== 'GET' && (req.headers['x-pixel-request'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site')) return res.status(403).json({ error: 'คำขอไม่ถูกต้อง' });
  const route = segments[1] ?? 'session';
  try {
    const db = getSupabase();
    if (['register', 'login'].includes(route) && req.method === 'POST') {
      const username = normalizeUsername(req.body?.username);
      const password = req.body?.password;
      if (typeof password !== 'string' || password.length < 1 || password.length > 128) return res.status(400).json({ error: 'กรอกรหัสผ่านไม่เกิน 128 ตัวอักษร' });
      const ip = String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0];
      for (const [bucket, limit] of [[`ip:${ip}`, 40], [`user:${username}`, 10]] as const) {
        const { data, error } = await db.rpc('external_auth_attempt', { p_bucket: digest(bucket), p_limit: limit });
        if (error) throw error;
        if (!data) return res.status(429).json({ error: 'ลองเข้าระบบหลายครั้งเกินไป กรุณารอ 15 นาที' });
      }
      let account: any;
      if (route === 'register') {
        const { data, error } = await db.from('external_accounts').insert({ username, password_hash: await hashPassword(password) }).select('id,username').single();
        if (error?.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
        if (error) throw error;
        account = data;
      } else {
        const { data, error } = await db.from('external_accounts').select('id,username,password_hash').eq('username', username).maybeSingle();
        if (error) throw error;
        const valid = await verifyPassword(password, data?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`);
        if (!data || !valid) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        account = data;
      }
      const token = randomBytes(32).toString('hex');
      const { error } = await db.from('external_sessions').insert({ token_hash: digest(token), owner_id: account.id, expires_at: new Date(Date.now() + DAYS * 1000).toISOString() });
      if (error) throw error;
      // Replacing this browser's login must stop pushes for its previous account.
      const previousToken = tokenFrom(req);
      if (previousToken) {
        const { error: revokeError } = await db.from('external_sessions').delete().eq('token_hash', digest(previousToken));
        if (revokeError) throw revokeError;
      }
      cookie(res, token);
      return res.json({ id: account.id, username: account.username });
    }
    const token = tokenFrom(req);
    if (route === 'logout' && req.method === 'POST') {
      if (token) { const { error } = await db.from('external_sessions').delete().eq('token_hash', digest(token)); if (error) throw error; }
      cookie(res, '', 0); return res.json({ ok: true });
    }
    const { data: session, error: sessionError } = token
      ? await db.from('external_sessions').select('owner_id,expires_at').eq('token_hash', digest(token)).gt('expires_at', new Date().toISOString()).maybeSingle()
      : { data: null, error: null };
    if (sessionError) throw sessionError;
    if (!session) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    const owner = session.owner_id;
    if (req.headers['x-pixel-account'] && req.headers['x-pixel-account'] !== owner) return res.status(409).json({ error: 'บัญชีเปลี่ยนไปในอีกแท็บ กรุณาโหลดหน้าใหม่ก่อนแก้ไข' });
    // Extend at most weekly; never recreate a revoked or expired session.
    if (shouldRenewSession(session.expires_at)) {
      const { data: renewed, error } = await db.from('external_sessions')
        .update({ expires_at: new Date(Date.now() + DAYS * 1000).toISOString() })
        .eq('token_hash', digest(token)).gt('expires_at', new Date().toISOString()).select('owner_id').maybeSingle();
      if (error) throw error;
      if (!renewed) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
      cookie(res, token);
    }
    if (route === 'push') return await externalPushAccount(req, res, owner, digest(token));
    if (route === 'session' && req.method === 'GET') {
      const { data, error } = await db.from('external_accounts').select('id,username').eq('id', owner).single();
      if (error) throw error; return res.json(data);
    }
    if (route === 'timers' && req.method === 'GET') {
      const { data, error } = await db.from('external_account_timers').select('id,data').eq('owner_id', owner).order('id');
      if (error) throw error; return res.json((data ?? []).map(serialize));
    }
    if (route === 'import' && req.method === 'POST') {
      if (!Array.isArray(req.body?.timers) || req.body.timers.length > 500) return res.status(400).json({ error: 'นำเข้าได้ครั้งละไม่เกิน 500 รายการ' });
      const rows = req.body.timers.map((timer: any) => {
        if (!Number.isSafeInteger(timer.floor_number) || timer.floor_number < 0) throw new Error('รหัสรายการเดิมไม่ถูกต้อง');
        return { owner_id: owner, import_key: `local:${timer.floor_number}`, data: validateTimer(timer) };
      });
      if (!rows.length) return res.json({ imported: 0 });
      const { data, error } = await db.from('external_account_timers').upsert(rows, { onConflict: 'owner_id,import_key', ignoreDuplicates: true }).select('id');
      if (error) throw error; return res.json({ imported: data?.length ?? 0 });
    }
    if (route === 'timers' && req.method === 'POST' && !segments[2]) {
      const { data, error } = await db.from('external_account_timers').insert({ owner_id: owner, data: validateTimer(req.body) }).select('id,data').single();
      if (error) throw error; return res.status(201).json(serialize(data));
    }
    if (route === 'timers' && req.method === 'DELETE') {
      const id = Number(segments[2]);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });
      // Timer foreign keys cascade to its pending push deliveries.
      const { error } = await db.from('external_account_timers').delete().eq('id', id).eq('owner_id', owner);
      if (error) throw error;
      return res.json({ ok: true });
    }
    if (route === 'timers' && req.method === 'PATCH') {
      const id = Number(segments[2]);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });
      const patch = validateTimer(req.body, true);
      // Merge and update atomically in SQL so concurrent disjoint edits survive.
      const { data, error } = await db.rpc('external_patch_timer', { p_id: id, p_owner: owner, p_patch: patch });
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'ไม่พบเครื่องนอกในบัญชีนี้' });
      return res.json(serialize(data[0]));
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const error = e as { message?: string; code?: string };
    if (error.code) { console.error('External account database error:', error.code); return res.status(503).json({ error: 'ระบบบัญชียังไม่พร้อม กรุณาลองใหม่ภายหลัง' }); }
    return res.status(400).json({ error: error.message ?? 'ไม่สามารถดำเนินการได้' });
  }
}

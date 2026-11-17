// Explicit opt-in integration smoke test; creates and removes only its own random accounts.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { getSupabase } from '../../api/lib/db';
async function main() {
  if (process.env.EXTERNAL_ACCOUNT_LIVE_TEST !== '1') throw new Error('Set EXTERNAL_ACCOUNT_LIVE_TEST=1 explicitly');
  config({ path: '.env.local', quiet: true });
  const ids: string[] = [];
  const base = 'http://localhost:9999/api/external-account/';
  const call = async (route: string, method = 'GET', body?: any, session = '') => {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-Pixel-Request': '1', Cookie: session }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
  };
  const password = randomBytes(24).toString('hex');
  const username = 'poc_' + randomBytes(8).toString('hex');
  try {
    const a = await call('register', 'POST', { username, password });
    assert.equal(a.status, 200, a.body.error); ids.push(a.body.id);
    assert.ok(a.cookie); assert.equal((await call('session', 'GET', undefined, a.cookie)).body.id, a.body.id);
    const b = await call('register', 'POST', { username: username + '_b', password });
    assert.equal(b.status, 200, b.body.error); ids.push(b.body.id);
    const original = { floor_number: 12345, name: 'POC import', character_name: 'test', status: 'running', start_time: '2026-11-16T08:00:00Z', estimated_duration_seconds: 7200 };
    assert.equal((await call('import', 'POST', { timers: [original] }, a.cookie)).body.imported, 1);
    const rows = (await call('timers', 'GET', undefined, a.cookie)).body;
    assert.equal(rows.length, 1); assert.equal(rows[0].start_time, original.start_time);
    const id = rows[0].floor_number;
    assert.deepEqual((await call('timers', 'GET', undefined, b.cookie)).body, []);
    assert.equal((await call(`timers/${id}`, 'PATCH', { name: 'intruder' }, b.cookie)).status, 404);
    assert.equal((await call(`timers/${id}`, 'PATCH', { name: 'changed on account' }, a.cookie)).status, 200);
    assert.equal((await call('import', 'POST', { timers: [original] }, a.cookie)).body.imported, 0);
    assert.equal((await call('timers', 'GET', undefined, a.cookie)).body[0].name, 'changed on account');
    // Simulate an older still-valid session and confirm server + browser renewal.
    const { error: ageError } = await getSupabase().from('external_sessions').update({ expires_at: new Date(Date.now() + 86400000).toISOString() }).eq('owner_id', a.body.id);
    assert.equal(ageError, null);
    const renewed = await call('session', 'GET', undefined, a.cookie);
    assert.equal(renewed.status, 200); assert.equal(renewed.cookie, a.cookie);
    const { data: renewedRows } = await getSupabase().from('external_sessions').select('expires_at').eq('owner_id', a.body.id);
    assert.ok(Date.parse(renewedRows![0].expires_at) - Date.now() > 89 * 86400000);
    const device2 = await call('login', 'POST', { username, password });
    assert.equal(device2.status, 200);
    assert.equal((await call('timers', 'GET', undefined, device2.cookie)).body[0].floor_number, id);
    await call('logout', 'POST', {}, a.cookie);
    assert.equal((await call('timers', 'GET', undefined, a.cookie)).status, 401);
    assert.equal((await call('timers', 'GET', undefined, device2.cookie)).status, 200);
    console.log('PASS: register/login, account isolation, import deduplication, original times, cross-session access, logout.');
  } finally {
    for (const id of ids) {
      const { error } = await getSupabase().from('external_accounts').delete().eq('id', id).like('username', 'poc_%');
      if (error) throw new Error('Test account cleanup failed');
    }
    console.log('Removed temporary POC accounts and their test timers.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

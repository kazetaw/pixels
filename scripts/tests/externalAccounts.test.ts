import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword, normalizeUsername, validateTimer, externalAccountHandler, shouldRenewSession, SESSION_SECONDS } from '../../api/lib/externalAccounts';

test('password hashes use unique salts and verify without storing plaintext', async () => {
  const a = await hashPassword('correct-password'); const b = await hashPassword('correct-password');
  assert.notEqual(a, b); assert.ok(!a.includes('correct-password'));
  assert.equal(await verifyPassword('correct-password', a), true);
  assert.equal(await verifyPassword('wrong-password', a), false);
});
test('normalizes account names and preserves imported timer clocks', () => {
  assert.equal(normalizeUsername(' SunLee '), 'sunlee');
  assert.throws(() => normalizeUsername('ab'));
  const row = validateTimer({ name: ' แลป ', character_name: 'ซันลี่', status: 'running', start_time: '2026-11-16T08:00:00Z', estimated_duration_seconds: 7200, owner_id: 'attacker', floor_number: 123 });
  assert.equal(row.start_time, '2026-11-16T08:00:00Z');
  assert.equal(row.name, 'แลป'); assert.ok(!('owner_id' in row)); assert.ok(!('floor_number' in row));
  assert.throws(() => validateTimer({ name: 'x', status: 'running' }));
  assert.throws(() => validateTimer({ estimated_duration_seconds: -1 }, true));
});
test('account API scopes reads, atomic edits and idempotent imports to authenticated owner', async () => {
  process.env.SUPABASE_URL = 'https://external-accounts-test.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const original = globalThis.fetch;
  const requests: { url: URL; body: any; headers: Headers }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? '{}')); const headers = new Headers(init?.headers);
    requests.push({ url, body, headers });
    let result: any = [];
    if (url.pathname.endsWith('/external_sessions')) result = { owner_id: 'owner-a' };
    if (url.pathname.endsWith('/external_patch_timer')) result = []; // Other user's ID not found.
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const call = async (method: string, path: string, body: any = {}, authenticated = true, crossSite = false) => {
    let status = 200; let result: any;
    const req = { method, body, headers: { 'x-pixel-request': '1', ...(authenticated ? { cookie: 'pixel_external_session=token' } : {}), ...(crossSite ? { 'sec-fetch-site': 'cross-site' } : {}) } };
    const res = { setHeader() {}, status(value: number) { status = value; return this; }, json(value: any) { result = value; return this; } };
    await externalAccountHandler(req as any, res as any, ['external-account', ...path.split('/')]);
    return { status, result };
  };
  try {
    assert.equal((await call('GET', 'timers', {}, false)).status, 401);
    assert.equal(requests.length, 0);
    await call('GET', 'timers');
    assert.equal(requests.at(-1)!.url.searchParams.get('owner_id'), 'eq.owner-a');
    assert.equal((await call('PATCH', 'timers/99', { name: 'attempt', owner_id: 'owner-b' })).status, 404);
    assert.equal(requests.at(-1)!.body.p_owner, 'owner-a');
    assert.deepEqual(requests.at(-1)!.body.p_patch, { name: 'attempt' });
    await call('POST', 'import', { timers: [{ floor_number: 123, name: 'local', owner_id: 'owner-b', status: 'running', start_time: '2026-11-16T08:00:00Z', estimated_duration_seconds: 7200 }] });
    assert.equal(requests.at(-1)!.body[0].owner_id, 'owner-a');
    assert.equal(requests.at(-1)!.body[0].import_key, 'local:123');
    assert.match(requests.at(-1)!.headers.get('prefer')!, /resolution=ignore-duplicates/);
    const before = requests.length;
    assert.equal((await call('POST', 'import', { timers: [] }, true, true)).status, 403);
    assert.equal(requests.length, before);
  } finally { globalThis.fetch = original; }
});

test('90-day sessions renew weekly but never revive expired sessions', () => {
  const now = Date.parse('2026-11-17T00:00:00Z');
  const expiry = (days: number) => new Date(now + days * 86400000).toISOString();
  assert.equal(SESSION_SECONDS, 90 * 86400);
  assert.equal(shouldRenewSession(expiry(90), now), false);
  assert.equal(shouldRenewSession(expiry(82), now), true);
  assert.equal(shouldRenewSession(expiry(1), now), true);
  assert.equal(shouldRenewSession(expiry(0), now), false);
  assert.equal(shouldRenewSession(expiry(-1), now), false);
});

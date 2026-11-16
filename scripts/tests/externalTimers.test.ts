import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../../api/index';

test('external timers isolate storage, preserve IDs on rename, and validate writes', async () => {
  process.env.SUPABASE_URL = 'https://external-timer-test.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const originalFetch = globalThis.fetch;
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.includes('/rest/v1/external_machine_timers'));
    const body = JSON.parse(String(init?.body ?? '{}'));
    requests.push({ url, body });
    return new Response(JSON.stringify(init?.method === 'GET' ? [] : { floor_number: 7, ...body }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  const call = async (method: string, path: string, body = {}) => {
    let status = 200; let data: any;
    const res = { setHeader() {}, status(n: number) { status = n; return this; }, json(value: unknown) { data = value; return this; } };
    await handler({ method, url: `/api/external-machines${path}`, body } as any, res as any);
    return { status, data };
  };
  try {
    const created = await call('POST', '', { name: ' แลปนอกวิศวะ ชั้น 1-3 ', floor_number: 999 });
    assert.equal(created.status, 201);
    assert.equal(created.data.name, 'แลปนอกวิศวะ ชั้น 1-3');
    assert.equal(created.data.floor_number, 7);
    assert.ok(!('floor_number' in requests[0].body));
    await call('PATCH', '/7', { name: 'ชื่อใหม่' });
    assert.ok(requests.at(-1)!.url.includes('floor_number=eq.7'));
    assert.deepEqual(requests.at(-1)!.body, { name: 'ชื่อใหม่' });
    await call('PATCH', '/7', { status: 'running', start_time: '2026-11-16T03:00:00Z', estimated_duration_seconds: 10800 });
    assert.equal(requests.at(-1)!.body.estimated_duration_seconds, 10800);
    const before = requests.length;
    for (const body of [{ name: ' ' }, { name: 'x'.repeat(121) }, { estimated_duration_seconds: -1 }, { status: 'bad' }, { start_time: 'bad' }]) {
      assert.equal((await call('PATCH', '/7', body)).status, 400);
    }
    assert.equal((await call('PATCH', '/bad', { name: 'name' })).status, 400);
    assert.equal(requests.length, before);
  } finally { globalThis.fetch = originalFetch; }
});

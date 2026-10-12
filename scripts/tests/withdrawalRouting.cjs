// Run: node --import tsx scripts/tests/withdrawalRouting.cjs
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
const { getSupabase } = require('../../api/lib/db.ts');
const handler = require('../../api/index.ts').default;
const calls = [];
getSupabase().rpc = async (name, args) => { calls.push({ name, args }); return { error: null }; };
async function request(path, body) {
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'PATCH', url: `/api/withdrawals/test-id${path}`, headers: {}, body }, res);
  return res;
}
(async () => {
  assert.equal((await request('/fulfill', { actual_lines: [{ item_id: 'a', quantity: 3 }], admin_note: 'partial' })).code, 200);
  assert.equal(calls[0].name, 'partial_fulfill_withdrawal');
  assert.equal(calls[0].args.p_actual_lines[0].quantity, 3);
  assert.equal((await request('', { status: 'sent' })).code, 200);
  assert.equal(calls[1].name, 'finish_withdrawal');
  assert.equal((await request('/fulfill', {})).body.error, 'actual_lines ไม่ถูกต้อง');
  assert.equal((await request('', {})).body.error, 'สถานะไม่ถูกต้อง');
  assert.equal((await request('/unknown', { status: 'sent' })).code, 405);
  assert.equal(calls.length, 2);
  console.log('PASS: partial fulfillment routing, normal status routing, validation and unknown paths');
})().catch(error => { console.error(error); process.exitCode = 1; });

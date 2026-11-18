import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { authorizedCron, notificationPayload, validateSubscription } from '../../api/lib/externalPush';

test('only supported HTTPS push providers are allowed; cron rejects missing/wrong secrets', () => {
  const keys = { p256dh: Buffer.alloc(65, 1).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') };
  for (const host of ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com']) {
    assert.equal(new URL(validateSubscription({ endpoint: `https://${host}/push/test`, keys }).endpoint).hostname, host);
  }
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.attacker.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x']) {
    assert.throws(() => validateSubscription({ endpoint, keys }));
  }
  assert.throws(() => validateSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'bad', auth: 'bad' } }));
  assert.equal(authorizedCron('Bearer correct', 'correct'), true);
  assert.equal(authorizedCron('Bearer wrong', 'correct'), false);
  assert.equal(authorizedCron(undefined, 'correct'), false);
  assert.equal(authorizedCron('Bearer ', ''), false);
});
test('notification links to a machine and stable tag deduplicates delivery retries', () => {
  const row = { timer_id: 12, run_start: '2026-11-18T01:00:00Z', due_at: '2026-11-18T04:00:00Z', timer_data: { name: 'แลป', character_name: 'ซันลี่' } };
  const payload = notificationPayload(row);
  assert.equal(payload.url, '/?externalTimer=12');
  assert.match(payload.body, /11:00 AM/);
  assert.match(payload.body, /ซันลี่/);
  const named = notificationPayload(row, 'หน่วยความจำ');
  assert.equal(named.title, 'หน่วยความจำ ผลิตเสร็จแล้ว');
  assert.match(named.body, /แลป · ซันลี่/);
  assert.equal(notificationPayload(row, ' ').title, payload.title);
  assert.equal(payload.tag, notificationPayload(row).tag);
  assert.notEqual(payload.tag, notificationPayload({ ...row, run_start: '2026-11-18T02:00:00Z' }).tag);
});
test('Postgres queue: scoped subscriptions, reschedule/reset, leases, expiry and logout', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await readFile('supabase/migrations/20261117_external_accounts.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/20261118_external_push.sql', 'utf8'));
    const ownerA = '00000000-0000-4000-8000-000000000001', ownerB = '00000000-0000-4000-8000-000000000002';
    await db.query('insert into external_accounts(id,username,password_hash) values ($1,$2,$3),($4,$5,$3)', [ownerA, 'alice', 'test', ownerB, 'bob']);
    await db.query("insert into external_sessions values ('session-a',$1,now()+interval '1 day'),('session-b',$2,now()+interval '1 day')", [ownerA, ownerB]);
    await db.query("insert into external_push_subscriptions(owner_id,session_hash,endpoint,subscription) values ($1,'session-a','https://fcm.googleapis.com/a','{}'),($2,'session-b','https://fcm.googleapis.com/b','{}')", [ownerA, ownerB]);
    const timer = { name: 'แลป', status: 'running', start_time: new Date(Date.now() - 3600_000).toISOString(), estimated_duration_seconds: 7200 };
    const { rows: [created] } = await db.query<{id: number}>('insert into external_account_timers(owner_id,data) values ($1,$2) returning id', [ownerA, timer]);
    const count = async () => (await db.query<{n:number}>('select count(*)::int n from external_push_deliveries')).rows[0].n;
    assert.equal(await count(), 1, 'only owner A device queued');
    await db.query("select * from external_patch_timer($1,$2,'{\"character_name\":\"changed\"}')", [created.id, ownerA]);
    assert.equal(await count(), 1, 'name changes do not duplicate');
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 0, 'not due');
    await db.exec("update external_push_deliveries set due_at=now()-interval '1 minute', next_attempt_at=now()-interval '1 minute'");
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 1);
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 0, 'lease prevents concurrent send');
    await db.exec("update external_push_deliveries set lease_until=now()-interval '1 second'");
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 1, 'expired lease retries');
    await db.query("select * from external_patch_timer($1,$2,'{\"status\":\"idle\"}')", [created.id, ownerA]);
    assert.equal(await count(), 0, 'reset cancels queued event');
    await db.query('select * from external_patch_timer($1,$2,$3)', [created.id, ownerA, timer]);
    assert.equal(await count(), 1);
    await db.query('select * from external_patch_timer($1,$2,$3)', [created.id, ownerA, { start_time: new Date().toISOString() }]);
    assert.equal(await count(), 1, 'restart replaces old run');
    await db.exec("update external_push_deliveries set due_at=now()-interval '16 minutes', next_attempt_at=now()-interval '16 minutes'");
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 0, 'stale alerts expire');
    await db.exec("delete from external_sessions where token_hash='session-a'");
    assert.equal(await count(), 0, 'logout removes device and queued deliveries');
    await db.query("insert into external_sessions values ('session-a2',$1,now()+interval '1 day')", [ownerA]);
    await db.query("insert into external_push_subscriptions(owner_id,session_hash,endpoint,subscription) values ($1,'session-a2','https://fcm.googleapis.com/a','{}')", [ownerA]);
    assert.equal(await count(), 1, 'enabling covers existing future running timer');
    await db.query('insert into external_account_timers(owner_id,data) values ($1,$2)', [ownerA, { ...timer, estimated_duration_seconds: 1 }]);
    assert.equal(await count(), 1, 'historical imports do not notify');
    await db.exec("update external_sessions set expires_at=now()-interval '1 second' where token_hash='session-a2'; update external_push_deliveries set due_at=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute'");
    assert.equal((await db.query('select * from external_push_claim()')).rows.length, 0, 'expired sessions do not receive pushes');
  } finally { await db.close(); }
});

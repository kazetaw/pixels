import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExternalTimer, readExternalTimers, updateExternalTimer } from '../../frontend/src/components/Floors/externalTimerStorage';
function memory(): Storage {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); },
    removeItem: k => { data.delete(k); }, clear: () => data.clear() };
}
test('timers persist locally, stay isolated between browsers, and retain start time when renamed', () => {
  const a = memory(); const b = memory();
  const first = createExternalTimer({ name: 'แลปนอกวิศวะ ชั้น 1-3' }, a);
  const second = createExternalTimer({ name: 'อีกเครื่อง' }, a);
  const start = '2026-11-16T08:00:00Z';
  updateExternalTimer(first.floor_number, { status: 'running', start_time: start, estimated_duration_seconds: 7200 }, a);
  updateExternalTimer(first.floor_number, { name: 'ชื่อใหม่' }, a);
  const loaded = readExternalTimers(a).find(t => t.floor_number === first.floor_number)!;
  assert.equal(loaded.start_time, start);
  assert.equal(loaded.estimated_duration_seconds, 7200);
  assert.equal(loaded.name, 'ชื่อใหม่');
  assert.equal(readExternalTimers(a).find(t => t.floor_number === second.floor_number)!.name, 'อีกเครื่อง');
  assert.deepEqual(readExternalTimers(b), []);
});
test('failed writes report errors and preserve existing timer', () => {
  const storage = memory();
  const timer = createExternalTimer({ name: 'เดิม' }, storage);
  storage.setItem = () => { throw new Error('QuotaExceeded'); };
  assert.throws(() => updateExternalTimer(timer.floor_number, { name: 'ใหม่' }, storage), /บันทึกเครื่องนอกไม่ได้/);
  assert.equal(readExternalTimers(storage)[0].name, 'เดิม');
});

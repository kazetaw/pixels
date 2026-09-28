import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTargets, daysUntil } from '../../frontend/src/components/Organization/dailyTargetMath';
test('deduct shared stock once from combined targets', () => {
  const [row] = dailyTargets([{item_id:'a',target:2000},{item_id:'a',target:2368}], {a:990}, 30);
  assert.equal(row.target,4368); assert.equal(row.remaining,3378); assert.equal(row.daily,113);
});
test('completed and overdue goals never divide by zero', () => {
  assert.equal(dailyTargets([{item_id:'a',target:10}], {a:20}, 30)[0].daily,0);
  assert.equal(dailyTargets([{item_id:'a',target:10}], {}, 0)[0].daily,null);
});
test('Bangkok calendar days exclude deadline and clamp past dates', () => {
  assert.equal(daysUntil('2026-10-28',new Date('2026-09-27T18:00:00Z')),30);
  assert.equal(daysUntil('2026-09-28',new Date('2026-09-27T18:00:00Z')),0);
  assert.equal(daysUntil('2026-09-20',new Date('2026-09-27T18:00:00Z')),0);
});

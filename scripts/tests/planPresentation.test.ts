import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupFloorRows, recipesForOccupation, recipeHours, summarizeProducts, formatPlanDuration } from '../../frontend/src/components/Planner/planPresentation';
import type { FloorPlanResult, Machine, Recipe } from '../../frontend/src/types';

test('27 floors retain their keyboard entry order across three groups', () => {
  const floors = Array.from({ length: 27 }, (_, i) => i + 1);
  const groups = groupFloorRows(floors);
  assert.deepEqual(groups.map((group) => group.length), [9, 9, 9]);
  assert.deepEqual(groups.flat(), floors);
  assert.deepEqual(groupFloorRows([]), []);
  assert.throws(() => groupFloorRows(floors, 0));
});

test('occupation filters include shared recipes and exclude unusable production times', () => {
  const machines: Machine[] = [
    { machine_id: 'farm', machine_name: 'เกษตร', occupation: 'เกษตร', floor_number: 1, max_hours_limit: 1 },
    { machine_id: 'shared', machine_name: 'ทุกอาชีพ', occupation: 'ทุกอาชีพ', floor_number: 2, max_hours_limit: 1 },
  ];
  const recipe = (id: string, machine_id: string, time_per_unit: string | null): Recipe => ({ id, name: id, machine_id, time_per_unit, ingredients: {} });
  const recipes = [recipe('farm', 'farm', '00:30:00'), recipe('shared', 'shared', '01:00:00'), recipe('zero', 'farm', '00:00:00'), recipe('missing', 'farm', null)];
  assert.deepEqual(recipesForOccupation(recipes, machines, 'ทุกอาชีพ').map((r) => r.id), ['farm', 'shared']);
  assert.deepEqual(recipesForOccupation(recipes, machines, 'หมอ').map((r) => r.id), ['shared']);
  assert.equal(recipeHours('invalid'), 0);
  assert.equal(recipeHours('00:30:00'), 0.5);
});

test('overview aggregates the same product across floors without merging distinct IDs', () => {
  const floor = (n: number, id: string, name: string, qty: number): FloorPlanResult => ({
    floor_number: n, recipe_id: id, recipe_name: name, output_qty: qty, cycles: qty / 12, time_per_unit: '01:00:00',
    bom_tree: { item_id: id, item_name: name, quantity_needed: qty, is_raw: false, children: [] },
  });
  const input = [floor(1, 'a', 'ช็อคโกแลตนม', 120), floor(2, 'a', 'ช็อคโกแลตนม', 240), floor(3, 'b', 'ไวท์ช็อคโกแลต', 60)];
  assert.deepEqual(summarizeProducts(input), [
    { id: 'a', name: 'ช็อคโกแลตนม', quantity: 360, floors: [1, 2] },
    { id: 'b', name: 'ไวท์ช็อคโกแลต', quantity: 60, floors: [3] },
  ]);
  assert.equal(input.length, 3);
  assert.equal(formatPlanDuration(48.5), '2 วัน 30 นาที');
});

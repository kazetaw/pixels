import assert from 'node:assert/strict';
import { test } from 'node:test';
import { machinesForProfession } from '../../frontend/src/components/Floors/floorOptions';
import type { Machine } from '../../frontend/src/types';

const machines: Machine[] = [
  { machine_id: '730b71d2-87d2-48c9-b4e0-a3e451edd0ee', machine_name: 'ตู้เพาะเมล็ดพันธุ์', occupation: 'เกษตร', floor_number: 1, max_hours_limit: 1 },
  { machine_id: 'doctor', machine_name: 'เครื่องผสมยา', occupation: 'หมอ', floor_number: 2, max_hours_limit: 1 },
  { machine_id: 'shared', machine_name: 'เครื่องใช้ร่วมกัน', occupation: 'ทุกอาชีพ', floor_number: 3, max_hours_limit: 1 },
];

test('a ทุกอาชีพ floor retains the saved agriculture machine and its name', () => {
  const options = machinesForProfession(machines, 'ทุกอาชีพ');
  assert.equal(options.find((machine) => machine.machine_id === machines[0].machine_id)?.machine_name, 'ตู้เพาะเมล็ดพันธุ์');
  assert.equal(options.length, 3);
});

test('a specific profession includes shared machines and excludes other professions', () => {
  assert.deepEqual(machinesForProfession(machines, 'หมอ').map((machine) => machine.machine_id), ['doctor', 'shared']);
});

test('an unset profession has no selectable machines', () => {
  assert.deepEqual(machinesForProfession(machines), []);
});

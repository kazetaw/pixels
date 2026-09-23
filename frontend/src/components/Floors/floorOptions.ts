import type { Machine } from '../../types';

export function machinesForProfession(machines: Machine[], profession?: string): Machine[] {
  if (!profession) return [];
  return machines.filter((machine) =>
    profession === 'ทุกอาชีพ' || machine.occupation === 'ทุกอาชีพ' || machine.occupation === profession,
  );
}

import type { MachineLayoutData } from './useSharedMachineLayout';

export function placeMachines(layout: MachineLayoutData, target: { machine: string; floor: number; slot: number }, quantity: number): MachineLayoutData {
  const floor = layout.floors.find(f => f.id === target.floor);
  if (!floor || floor.slots[target.slot] !== null || !Number.isSafeInteger(quantity) || quantity < 1) return layout;
  const used = layout.floors.reduce((sum, f) => sum + f.slots.filter(id => id === target.machine).length, 0);
  const empty = floor.slots.filter(id => id === null).length;
  if (quantity > empty || quantity > (layout.owned[target.machine] ?? 0) - used) return layout;
  const slots = [...floor.slots];
  let remaining = quantity;
  for (let offset = 0; offset < slots.length && remaining > 0; offset++) {
    const index = (target.slot + offset) % slots.length;
    if (slots[index] === null) { slots[index] = target.machine; remaining--; }
  }
  return { ...layout, floors: layout.floors.map(f => f.id === target.floor ? { ...f, slots } : f) };
}

export function validMachineLayout(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { owned?: Record<string, number>; floors?: { id: number; slots: (string | null)[] }[] };
  if (!v.owned || typeof v.owned !== 'object' || Array.isArray(v.owned) || !Array.isArray(v.floors) || v.floors.length > 500) return false;
  if (Object.entries(v.owned).some(([id, n]) => !id || !Number.isSafeInteger(n) || n < 0)) return false;
  const ids = new Set<number>();
  const used = new Map<string, number>();
  for (const floor of v.floors) {
    if (!floor || !Number.isSafeInteger(floor.id) || floor.id < 1 || ids.has(floor.id) || !Array.isArray(floor.slots) || floor.slots.length !== 12) return false;
    ids.add(floor.id);
    for (const id of floor.slots) {
      if (id === null) continue;
      if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(v.owned, id)) return false;
      used.set(id, (used.get(id) ?? 0) + 1);
      if (used.get(id)! > v.owned[id]) return false;
    }
  }
  return true;
}

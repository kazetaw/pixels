import type { FloorPlanResult, Recipe, Machine } from '../../types';

export function recipeHours(time: string | null): number {
  if (!time) return 0;
  const parts = time.split(':').map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value) || value < 0)) return 0;
  return parts[0] + parts[1] / 60 + parts[2] / 3600;
}

export function recipesForOccupation(recipes: Recipe[], machines: Machine[], occupation: string): Recipe[] {
  const occupations = new Map(machines.map((machine) => [machine.machine_id, machine.occupation]));
  return recipes.filter((recipe) => {
    const assigned = occupations.get(recipe.machine_id ?? '');
    return recipeHours(recipe.time_per_unit) > 0 &&
      (!occupation || occupation === 'ทุกอาชีพ' || assigned === 'ทุกอาชีพ' || assigned === occupation);
  }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

export function groupFloorRows<T>(rows: T[], groupSize = 9): T[][] {
  if (!Number.isInteger(groupSize) || groupSize < 1) throw new Error('groupSize must be a positive integer');
  return Array.from({ length: Math.ceil(rows.length / groupSize) }, (_, index) => rows.slice(index * groupSize, (index + 1) * groupSize));
}

export function summarizeProducts(floors: FloorPlanResult[]) {
  const products = new Map<string, { id: string; name: string; quantity: number; floors: number[] }>();
  for (const floor of floors) {
    const product = products.get(floor.recipe_id) ?? { id: floor.recipe_id, name: floor.recipe_name, quantity: 0, floors: [] };
    product.quantity += floor.output_qty;
    product.floors.push(floor.floor_number);
    products.set(product.id, product);
  }
  return Array.from(products.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'th'));
}

export function formatPlanDuration(hours: number): string {
  const minutes = Math.round(hours * 60);
  return [Math.floor(minutes / 1440) && `${Math.floor(minutes / 1440)} วัน`,
    Math.floor(minutes % 1440 / 60) && `${Math.floor(minutes % 1440 / 60)} ชม.`,
    minutes % 60 && `${minutes % 60} นาที`].filter(Boolean).join(' ') || '0 นาที';
}

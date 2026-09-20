import { Machine, Recipe, StockMap } from '../types';

/**
 * Names are compared without surrounding whitespace or case differences.
 * IDs that belong to recipes are stock references, not raw-material names.
 */
export function normalizeName(name: string): string {
  return name.trim().normalize('NFKC').toLocaleLowerCase('th');
}

export interface NameConflict {
  type: 'สินค้า' | 'เครื่องจักร' | 'วัตถุดิบ';
  name: string;
}

export function findNameConflict(
  candidate: string,
  { recipes, machines, stocks, excludeRecipeId, excludeMachineId }: {
    recipes: Recipe[];
    machines: Machine[];
    stocks: StockMap;
    excludeRecipeId?: string;
    excludeMachineId?: string;
  },
): NameConflict | undefined {
  const normalized = normalizeName(candidate);
  if (!normalized) return undefined;

  const recipe = recipes.find((r) => r.id !== excludeRecipeId && normalizeName(r.name) === normalized);
  if (recipe) return { type: 'สินค้า', name: recipe.name };

  const machine = machines.find((m) => m.machine_id !== excludeMachineId && normalizeName(m.machine_name) === normalized);
  if (machine) return { type: 'เครื่องจักร', name: machine.machine_name };

  const recipeIds = new Set(recipes.map((r) => r.id));
  const stockName = Object.keys(stocks).find((key) => !recipeIds.has(key) && normalizeName(key) === normalized);
  if (stockName) return { type: 'วัตถุดิบ', name: stockName };
}

export function duplicateNameError(conflict: NameConflict): string {
  return `ชื่อนี้ซ้ำกับ${conflict.type} "${conflict.name}" กรุณาใช้ชื่ออื่น`;
}

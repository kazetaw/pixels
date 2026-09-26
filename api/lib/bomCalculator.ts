/**
 * api/lib/bomCalculator.ts — ported from backend/src/services/bomCalculator.ts
 */

import type {
  Recipe,
  Machine,
  StockMap,
  TargetItem,
  ShoppingListEntry,
  MachineWorkloadEntry,
  CalculateResponse,
} from './types.js';
import { parseTimeToHours } from './time.js';

function snakeToTitleCase(id: string): string {
  return id
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function explode(
  itemId: string,
  quantityNeeded: number,
  recipeMap: Map<string, Recipe>,
  workingStock: Record<string, number>,
  rawNetMap: Map<string, number>,
  rawTotalMap: Map<string, number>,
  machineHoursMap: Map<string, number>
): void {
  const available = workingStock[itemId] ?? 0;
  const netQty = Math.max(0, quantityNeeded - available);
  workingStock[itemId] = Math.max(0, available - quantityNeeded);

  if (netQty === 0) return;

  const recipe = recipeMap.get(itemId);

  if (!recipe) {
    rawTotalMap.set(itemId, (rawTotalMap.get(itemId) ?? 0) + quantityNeeded);
    rawNetMap.set(itemId, (rawNetMap.get(itemId) ?? 0) + netQty);
    return;
  }

  if (recipe.time_per_unit !== null) {
    const hoursPerUnit = parseTimeToHours(recipe.time_per_unit);
    machineHoursMap.set(
      recipe.machine_id!,
      (machineHoursMap.get(recipe.machine_id!) ?? 0) + netQty * hoursPerUnit
    );
  }

  for (const [ingredientId, ingredientQty] of Object.entries(recipe.ingredients)) {
    explode(
      ingredientId,
      ingredientQty * netQty,
      recipeMap,
      workingStock,
      rawNetMap,
      rawTotalMap,
      machineHoursMap
    );
  }
}

export function calculate(
  targets: TargetItem[],
  recipes: Recipe[],
  machines: Machine[],
  stocks: StockMap,
  itemNames: Record<string, string> = {}
): CalculateResponse {
  const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
  const machineMap = new Map<string, Machine>(machines.map((m) => [m.machine_id, m]));
  const itemNameMap = new Map<string, string>(Object.entries(itemNames));
  for (const recipe of recipes) itemNameMap.set(recipe.id, recipe.name);

  const workingStock: Record<string, number> = { ...stocks };

  const rawNetMap = new Map<string, number>();
  const rawTotalMap = new Map<string, number>();
  const machineHoursMap = new Map<string, number>();

  for (const target of targets) {
    explode(
      target.target_item_id,
      target.target_quantity,
      recipeMap,
      workingStock,
      rawNetMap,
      rawTotalMap,
      machineHoursMap
    );
  }

  const shopping_list: ShoppingListEntry[] = [];
  for (const [itemId, netRequired] of rawNetMap.entries()) {
    const totalNeeded = rawTotalMap.get(itemId) ?? netRequired;
    const itemName = itemNameMap.get(itemId) ?? snakeToTitleCase(itemId);
    shopping_list.push({ item_id: itemId, item_name: itemName, total_needed: totalNeeded, net_required: netRequired });
  }
  for (const [itemId, totalNeeded] of rawTotalMap.entries()) {
    if (!rawNetMap.has(itemId)) {
      const itemName = itemNameMap.get(itemId) ?? snakeToTitleCase(itemId);
      shopping_list.push({ item_id: itemId, item_name: itemName, total_needed: totalNeeded, net_required: 0 });
    }
  }

  const machine_workloads: MachineWorkloadEntry[] = [];
  for (const [machineId, hoursRequired] of machineHoursMap.entries()) {
    if (hoursRequired <= 0) continue;
    const machine = machineMap.get(machineId);
    if (!machine) {
      machine_workloads.push({
        machine_id: machineId,
        machine_name: snakeToTitleCase(machineId),
        floor_number: 0,
        hours_required: hoursRequired,
        max_hours_limit: 0,
      });
      continue;
    }
    machine_workloads.push({
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      floor_number: machine.floor_number,
      hours_required: hoursRequired,
      max_hours_limit: machine.max_hours_limit,
    });
  }

  return { shopping_list, machine_workloads };
}

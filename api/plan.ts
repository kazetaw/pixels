/**
 * api/plan.ts  →  POST /api/plan
 * Production planner — ported from backend/src/routes/plan.ts
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRecipes, readStocks } from './lib/db.js';
import { parseTimeToHours } from './lib/time.js';
import type {
  Recipe,
  StockMap,
  PlanRequest,
  PlanResponse,
  FloorPlanResult,
  BomTreeNode,
  RawMaterialEntry,
  IntermediateSupplyEntry,
} from './lib/types.js';
import { applyCors } from './lib/cors.js';

const SLOTS_DEFAULT = 12;

function toHours(days: number, hours = 0, minutes = 0): number {
  return days * 24 + hours + minutes / 60;
}

function buildTree(
  itemId: string,
  quantity: number,
  recipeMap: Map<string, Recipe>,
  nameMap: Map<string, string>,
  floorProducesMap: Map<string, number>
): BomTreeNode {
  const recipe = recipeMap.get(itemId);
  const name = nameMap.get(itemId) ?? itemId;

  if (!recipe || Object.keys(recipe.ingredients).length === 0) {
    return { item_id: itemId, item_name: name, quantity_needed: quantity, is_raw: true, children: [] };
  }

  const children: BomTreeNode[] = Object.entries(recipe.ingredients).map(
    ([ingId, ingQty]) => buildTree(ingId, ingQty * quantity, recipeMap, nameMap, floorProducesMap)
  );

  return {
    item_id: itemId,
    item_name: name,
    quantity_needed: quantity,
    is_raw: false,
    produced_by_floor: floorProducesMap.get(itemId),
    children,
  };
}

function accumulateRaw(node: BomTreeNode, acc: Map<string, { name: string; qty: number }>) {
  if (node.is_raw) {
    const existing = acc.get(node.item_id);
    acc.set(node.item_id, { name: node.item_name, qty: (existing?.qty ?? 0) + node.quantity_needed });
    return;
  }
  for (const child of node.children) accumulateRaw(child, acc);
}

function accumulateIntermediate(
  node: BomTreeNode,
  acc: Map<string, { name: string; needed: number }>
) {
  if (!node.is_raw) {
    for (const child of node.children) {
      if (!child.is_raw) {
        const existing = acc.get(child.item_id);
        acc.set(child.item_id, {
          name: child.item_name,
          needed: (existing?.needed ?? 0) + child.quantity_needed,
        });
      }
      accumulateIntermediate(child, acc);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body as PlanRequest;

  if (!body || typeof body !== 'object')
    return res.status(400).json({ error: 'Request body is required' });
  if (typeof body.event_days !== 'number' || body.event_days <= 0)
    return res.status(400).json({ error: 'event_days must be a positive number' });
  if (!Array.isArray(body.floor_assignments) || body.floor_assignments.length === 0)
    return res.status(400).json({ error: 'floor_assignments must be a non-empty array' });

  const slotsPerFloor = body.slots_per_floor ?? SLOTS_DEFAULT;
  const eventHours = toHours(body.event_days, body.event_hours, body.event_minutes);

  try {
    const [recipes, stocks] = await Promise.all([readRecipes(), readStocks()]);

    const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]));
    const nameMap = new Map<string, string>(recipes.map((r) => [r.id, r.name]));

    for (const fa of body.floor_assignments) {
      if (!recipeMap.has(fa.recipe_id))
        return res.status(400).json({
          error: `Unknown recipe_id "${fa.recipe_id}" for floor ${fa.floor_number}`,
        });
    }

    const floorProducesMap = new Map<string, number>();
    for (const fa of body.floor_assignments) {
      if (!floorProducesMap.has(fa.recipe_id)) floorProducesMap.set(fa.recipe_id, fa.floor_number);
    }

    const floorResults: FloorPlanResult[] = [];
    for (const fa of body.floor_assignments) {
      const recipe = recipeMap.get(fa.recipe_id)!;
      const timePerUnitHours = parseTimeToHours(recipe.time_per_unit);
      const cycles = timePerUnitHours > 0 ? Math.floor(eventHours / timePerUnitHours) : 0;
      const outputQty = cycles * slotsPerFloor;
      const bomTree = buildTree(recipe.id, outputQty, recipeMap, nameMap, floorProducesMap);
      floorResults.push({
        floor_number: fa.floor_number,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        time_per_unit: recipe.time_per_unit ?? '00:00:00',
        cycles,
        output_qty: outputQty,
        bom_tree: bomTree,
      });
    }

    const rawAcc = new Map<string, { name: string; qty: number }>();
    for (const fr of floorResults) accumulateRaw(fr.bom_tree, rawAcc);

    const raw_materials: RawMaterialEntry[] = Array.from(rawAcc.entries()).map(
      ([itemId, { name, qty }]) => {
        const inStock = (stocks as StockMap)[itemId] ?? 0;
        return {
          item_id: itemId,
          item_name: name,
          total_needed: qty,
          in_stock: inStock,
          net_required: Math.max(0, qty - inStock),
          sufficient: inStock >= qty,
        };
      }
    );
    raw_materials.sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? 1 : -1;
      return b.total_needed - a.total_needed;
    });

    const intermediateNeededAcc = new Map<string, { name: string; needed: number }>();
    for (const fr of floorResults) accumulateIntermediate(fr.bom_tree, intermediateNeededAcc);

    const intermediateProducedAcc = new Map<string, number>();
    for (const fr of floorResults) {
      intermediateProducedAcc.set(
        fr.recipe_id,
        (intermediateProducedAcc.get(fr.recipe_id) ?? 0) + fr.output_qty
      );
    }

    const intermediate_supply: IntermediateSupplyEntry[] = [];
    for (const [itemId, { name, needed }] of intermediateNeededAcc.entries()) {
      const produced = intermediateProducedAcc.get(itemId) ?? 0;
      intermediate_supply.push({
        item_id: itemId,
        item_name: name,
        needed,
        produced,
        sufficient: produced >= needed,
        shortfall: Math.max(0, needed - produced),
      });
    }
    intermediate_supply.sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? 1 : -1;
      return b.shortfall - a.shortfall;
    });

    const response: PlanResponse = {
      event_total_hours: eventHours,
      floor_results: floorResults,
      intermediate_supply,
      raw_materials,
    };

    res.json(response);
  } catch (err) {
    console.error('POST /api/plan error:', err);
    res.status(500).json({ error: 'Production plan calculation failed' });
  }
}

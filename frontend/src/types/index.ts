// frontend/src/types/index.ts

export interface Recipe {
  id: string;
  name: string;
  machine_id: string;
  time_per_unit: string | null; // "HH:MM:SS" format; null = no processing time (raw/direct item)
  ingredients: Record<string, number>; // item_id -> quantity
}

export interface Machine {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  max_hours_limit: number; // event duration limit in hours
}

export type StockMap = Record<string, number>; // item_id -> quantity

export interface TargetItem {
  target_item_id: string;
  target_quantity: number;
}

export interface ShoppingListEntry {
  item_id: string;
  item_name: string;
  total_needed: number;  // gross quantity before stock deduction
  net_required: number;  // quantity still needed after stock deduction
}

export interface MachineWorkloadEntry {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  hours_required: number;
  max_hours_limit: number;
}

export interface CalculateResponse {
  shopping_list: ShoppingListEntry[];
  machine_workloads: MachineWorkloadEntry[];
}

export interface AppData {
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;
}

// ── Production Planner types ──────────────────────────────────────────────────

export interface FloorAssignment {
  floor_number: number;
  recipe_id: string;
}

export interface PlanRequest {
  event_days: number;
  event_hours?: number;
  event_minutes?: number;
  slots_per_floor: number;
  floor_assignments: FloorAssignment[];
}

export interface BomTreeNode {
  item_id: string;
  item_name: string;
  quantity_needed: number;
  is_raw: boolean;
  produced_by_floor?: number;
  children: BomTreeNode[];
}

export interface FloorPlanResult {
  floor_number: number;
  recipe_id: string;
  recipe_name: string;
  time_per_unit: string;    // "HH:MM:SS"
  cycles: number;
  output_qty: number;
  bom_tree: BomTreeNode;
}

export interface RawMaterialEntry {
  item_id: string;
  item_name: string;
  total_needed: number;
  in_stock: number;
  net_required: number;
  sufficient: boolean;
}

export interface IntermediateSupplyEntry {
  item_id: string;
  item_name: string;
  needed: number;
  produced: number;
  sufficient: boolean;
  shortfall: number;
}

export interface PlanResponse {
  event_total_hours: number;
  floor_results: FloorPlanResult[];
  intermediate_supply: IntermediateSupplyEntry[];
  raw_materials: RawMaterialEntry[];
}

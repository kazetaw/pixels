// backend/src/types/index.ts

export interface Recipe {
  id: string;
  name: string;
  machine_id: string | null;     // null = ยังไม่กำหนดเครื่องจักร
  time_per_unit: string | null;
  ingredients: Record<string, number>;
  image?: string;
}

/** Per-item image store: item_id → base64/URL image */
export type StockImageMap = Record<string, string>;

export type Currency = 'THB' | 'G';

export interface Budget {
  currency: Currency;
  limit_amount: number;
}

export interface StockPurchase {
  id: string;
  item_id: string;
  quantity: number;
  total_amount: number;
  currency: Currency;
  source?: string;
  contributor?: string;  // ผู้ให้งบ / ผู้จ่ายเงิน
  purchased_at: string;
}

export interface Machine {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  max_hours_limit: number; // event duration limit in hours
  image?: string;           // URL or base64 image
  occupation?: 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';
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

/** Input: one floor assignment */
export interface FloorAssignment {
  floor_number: number;   // 1–27
  recipe_id: string;      // UUID of the recipe to produce on this floor
}

/** Request body for POST /api/plan */
export interface PlanRequest {
  event_days: number;       // e.g. 30
  event_hours?: number;     // additional hours (default 0)
  event_minutes?: number;   // additional minutes (default 0)
  slots_per_floor: number;  // machines per floor (default 12)
  floor_assignments: FloorAssignment[];
}

/** One node in the BOM tree (recursive) */
export interface BomTreeNode {
  item_id: string;
  item_name: string;
  quantity_needed: number;    // total to produce/acquire
  is_raw: boolean;            // true = no recipe (leaf / buy)
  produced_by_floor?: number; // floor number that produces this (if assigned)
  children: BomTreeNode[];
}

/** Per-floor production summary */
export interface FloorPlanResult {
  floor_number: number;
  recipe_id: string;
  recipe_name: string;
  time_per_unit: string;    // "HH:MM:SS"
  cycles: number;           // floor(event_hours / time_per_unit_hours)
  output_qty: number;       // cycles × slots_per_floor
  bom_tree: BomTreeNode;    // expanded BOM for this floor's total output
}

/** Aggregate raw material entry */
export interface RawMaterialEntry {
  item_id: string;
  item_name: string;
  total_needed: number;
  in_stock: number;
  net_required: number;     // total_needed - in_stock (clamped to 0)
  sufficient: boolean;      // in_stock >= total_needed
}

/** Supply validation: intermediate products */
export interface IntermediateSupplyEntry {
  item_id: string;
  item_name: string;
  needed: number;           // total consumed by higher-tier floors
  produced: number;         // total output by floors assigned to this recipe
  sufficient: boolean;
  shortfall: number;        // max(0, needed - produced)
}

/** Response from POST /api/plan */
export interface PlanResponse {
  event_total_hours: number;
  floor_results: FloorPlanResult[];
  intermediate_supply: IntermediateSupplyEntry[];
  raw_materials: RawMaterialEntry[];
}

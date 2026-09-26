/**
 * api/lib/types.ts
 *
 * Shared TypeScript types for Vercel API Functions.
 * Mirrors backend/src/types/index.ts — keep in sync.
 */

export interface Recipe {
  id: string;
  name: string;
  machine_id: string | null;
  time_per_unit: string | null;   // "HH:MM:SS"
  ingredients: Record<string, number>; // item_id → quantity
  image?: string;                 // URL from Supabase Storage (not base64)
}

export interface Machine {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  max_hours_limit: number;        // computed, not stored
  image?: string;                 // URL from Supabase Storage
  occupation?: 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';
}

export type StockMap = Record<string, number>;      // item_id → quantity
export type StockImageMap = Record<string, string>; // item_id → URL

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
  purchased_at: string;
}

export interface TargetItem {
  target_item_id: string;
  target_quantity: number;
}

export interface ShoppingListEntry {
  item_id: string;
  item_name: string;
  total_needed: number;
  net_required: number;
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
  stockImages: StockImageMap;
  itemNames: Record<string, string>;
}

// ── Floor timer ──────────────────────────────────────────────────────────────
export type FloorStatus = 'idle' | 'running' | 'completed' | 'floating';

export interface FloorTimer {
  floor_number: number;
  profession?: string;
  machine_id: string | null;
  recipe_id: string | null;
  status: 'idle' | 'running'; // completed/floating are calculated from timestamps
  start_time: string | null;
  estimated_duration_seconds: number;
  completed_at: string | null;
}

// ── Production Planner ────────────────────────────────────────────────────────

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

export interface PlannerFloorRow {
  floor_number: number;
  occupation: string;
  recipe_id: string;
}

export interface SharedPlannerPlan {
  event_days: number;
  event_hours: number;
  event_minutes: number;
  floors: PlannerFloorRow[];
  updated_at?: string;
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
  time_per_unit: string;
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

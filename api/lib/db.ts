/**
 * api/lib/db.ts
 *
 * Supabase client singleton + typed read/write helpers.
 * Replaces backend/src/services/fileStore.ts
 *
 * Uses the SERVICE ROLE key so it bypasses RLS — safe only for
 * server-side code (Vercel Functions), never expose in the browser.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Budget, Currency, Recipe, Machine, StockMap, StockImageMap, StockPurchase, FloorTimer, SharedPlannerPlan } from './types.js';

// ── Singleton ─────────────────────────────────────────────────────────────────
let _client: SupabaseClient | null = null;
let sharedPlannerBucket: Promise<void> | null = null;

const SHARED_PLANNER_BUCKET = 'app-data';
const SHARED_PLANNER_PATH = 'planner/shared-plan.json';

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

async function ensureSharedPlannerBucket(): Promise<void> {
  if (!sharedPlannerBucket) {
    sharedPlannerBucket = (async () => {
      const { error } = await getSupabase().storage.createBucket(SHARED_PLANNER_BUCKET, {
        public: false,
        fileSizeLimit: '64KB',
      });
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`create planner storage: ${error.message}`);
      }
    })();
  }
  return sharedPlannerBucket;
}

/** The planner is one shared draft, stored privately and read only through the API. */
export async function readSharedPlannerPlan(): Promise<SharedPlannerPlan | null> {
  await ensureSharedPlannerBucket();
  const { data, error } = await getSupabase().storage
    .from(SHARED_PLANNER_BUCKET)
    .download(SHARED_PLANNER_PATH);
    if (error) {
      if (String((error as { statusCode?: string | number }).statusCode) === '404') return null;
    throw new Error(`read shared planner: ${error.message}`);
  }
  try {
    return JSON.parse(await data.text()) as SharedPlannerPlan;
  } catch {
    throw new Error('read shared planner: stored plan is invalid');
  }
}

export async function writeSharedPlannerPlan(plan: SharedPlannerPlan): Promise<SharedPlannerPlan> {
  await ensureSharedPlannerBucket();
  const saved = { ...plan, updated_at: new Date().toISOString() };
  const { error } = await getSupabase().storage
    .from(SHARED_PLANNER_BUCKET)
    .upload(SHARED_PLANNER_PATH, JSON.stringify(saved), {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: true,
    });
  if (error) throw new Error(`write shared planner: ${error.message}`);
  return saved;
}

// ── Machines ──────────────────────────────────────────────────────────────────

/** Read all machines ordered by floor_number asc */
export async function readMachines(): Promise<Machine[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('machines')
    .select('machine_id, machine_name, floor_number, occupation, image_url')
    .order('floor_number', { ascending: true });

  if (error) throw new Error(`readMachines: ${error.message}`);

  return (data ?? []).map((row) => ({
    machine_id:      row.machine_id,
    machine_name:    row.machine_name,
    floor_number:    row.floor_number,
    occupation:      row.occupation ?? undefined,
    image:           row.image_url ?? undefined,
    max_hours_limit: 0, // computed at read time from recipes
  }));
}

/** Insert a new machine row */
export async function insertMachine(
  m: Omit<Machine, 'machine_id' | 'max_hours_limit'>
): Promise<Machine> {
  const db = getSupabase();
  const { data, error } = await db
    .from('machines')
    .insert({
      machine_name: m.machine_name,
      floor_number: m.floor_number,
      occupation:   m.occupation ?? null,
      image_url:    m.image ?? null,
    })
    .select('machine_id, machine_name, floor_number, occupation, image_url')
    .single();

  if (error) throw new Error(`insertMachine: ${error.message}`);

  return {
    machine_id:      data.machine_id,
    machine_name:    data.machine_name,
    floor_number:    data.floor_number,
    occupation:      data.occupation ?? undefined,
    image:           data.image_url ?? undefined,
    max_hours_limit: 0,
  };
}

/** Update an existing machine */
export async function updateMachine(
  id: string,
  fields: Partial<Omit<Machine, 'machine_id' | 'max_hours_limit'>>
): Promise<Machine> {
  const db = getSupabase();
  const patch: Record<string, unknown> = {};
  if (fields.machine_name !== undefined) patch.machine_name = fields.machine_name;
  if (fields.floor_number !== undefined) patch.floor_number = fields.floor_number;
  if (fields.occupation   !== undefined) patch.occupation   = fields.occupation ?? null;
  if (fields.image        !== undefined) patch.image_url    = fields.image ?? null;

  const { data, error } = await db
    .from('machines')
    .update(patch)
    .eq('machine_id', id)
    .select('machine_id, machine_name, floor_number, occupation, image_url')
    .single();

  if (error) throw new Error(`updateMachine: ${error.message}`);

  return {
    machine_id:      data.machine_id,
    machine_name:    data.machine_name,
    floor_number:    data.floor_number,
    occupation:      data.occupation ?? undefined,
    image:           data.image_url ?? undefined,
    max_hours_limit: 0,
  };
}

/** Delete a machine by id */
export async function deleteMachine(id: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('machines').delete().eq('machine_id', id);
  if (error) throw new Error(`deleteMachine: ${error.message}`);
}

// ── Recipes ───────────────────────────────────────────────────────────────────

/** Read all recipes */
export async function readRecipes(): Promise<Recipe[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('recipes')
    .select('id, name, machine_id, time_per_unit, ingredients, image_url')
    .order('name', { ascending: true });

  if (error) throw new Error(`readRecipes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id:            row.id,
    name:          row.name,
    machine_id:    row.machine_id ?? null,
    time_per_unit: row.time_per_unit ?? null,
    ingredients:   (row.ingredients as Record<string, number>) ?? {},
    image:         row.image_url ?? undefined,
  }));
}

/** Insert a new recipe */
export async function insertRecipe(
  r: Omit<Recipe, 'id'>
): Promise<Recipe> {
  const db = getSupabase();
  const { data, error } = await db
    .from('recipes')
    .insert({
      name:          r.name,
      machine_id:    r.machine_id ?? null,
      time_per_unit: r.time_per_unit ?? null,
      ingredients:   r.ingredients,
      image_url:     r.image ?? null,
    })
    .select('id, name, machine_id, time_per_unit, ingredients, image_url')
    .single();

  if (error) throw new Error(`insertRecipe: ${error.message}`);

  return {
    id:            data.id,
    name:          data.name,
    machine_id:    data.machine_id ?? null,
    time_per_unit: data.time_per_unit ?? null,
    ingredients:   (data.ingredients as Record<string, number>) ?? {},
    image:         data.image_url ?? undefined,
  };
}

/** Update an existing recipe */
export async function updateRecipe(
  id: string,
  fields: Partial<Omit<Recipe, 'id'>>
): Promise<Recipe> {
  const db = getSupabase();
  const patch: Record<string, unknown> = {};
  if (fields.name          !== undefined) patch.name          = fields.name;
  if (fields.machine_id    !== undefined) patch.machine_id    = fields.machine_id ?? null;
  if (fields.time_per_unit !== undefined) patch.time_per_unit = fields.time_per_unit ?? null;
  if (fields.ingredients   !== undefined) patch.ingredients   = fields.ingredients;
  if (fields.image         !== undefined) patch.image_url     = fields.image ?? null;

  const { data, error } = await db
    .from('recipes')
    .update(patch)
    .eq('id', id)
    .select('id, name, machine_id, time_per_unit, ingredients, image_url')
    .single();

  if (error) throw new Error(`updateRecipe: ${error.message}`);

  return {
    id:            data.id,
    name:          data.name,
    machine_id:    data.machine_id ?? null,
    time_per_unit: data.time_per_unit ?? null,
    ingredients:   (data.ingredients as Record<string, number>) ?? {},
    image:         data.image_url ?? undefined,
  };
}

/** Delete a recipe by id */
export async function deleteRecipe(id: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('recipes').delete().eq('id', id);
  if (error) throw new Error(`deleteRecipe: ${error.message}`);
}

// ── Stocks ────────────────────────────────────────────────────────────────────

/** Read all stocks as a flat { item_id: quantity } map */
export async function readStocks(): Promise<StockMap> {
  const db = getSupabase();
  const { data, error } = await db.from('stocks').select('item_id, quantity');
  if (error) throw new Error(`readStocks: ${error.message}`);
  const map: StockMap = {};
  for (const row of data ?? []) map[row.item_id] = row.quantity;
  return map;
}

/**
 * Overwrite all stocks:
 * - Delete rows whose item_id is no longer in the new map
 * - Upsert rows that are present
 */
export async function writeStocks(stocks: StockMap): Promise<void> {
  const db = getSupabase();
  const rows = Object.entries(stocks).map(([item_id, quantity]) => ({
    item_id,
    quantity,
  }));

  if (rows.length === 0) {
    // Delete everything
    const { error } = await db.from('stocks').delete().neq('item_id', '');
    if (error) throw new Error(`writeStocks(clear): ${error.message}`);
    return;
  }

  // Upsert all provided rows
  const { error: upsertErr } = await db
    .from('stocks')
    .upsert(rows, { onConflict: 'item_id' });
  if (upsertErr) throw new Error(`writeStocks(upsert): ${upsertErr.message}`);

  // Delete rows not in new map
  const keepIds = rows.map((r) => r.item_id);
  const { error: delErr } = await db
    .from('stocks')
    .delete()
    .not('item_id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`);
  if (delErr) throw new Error(`writeStocks(delete): ${delErr.message}`);
}

/** Upsert a single stock item (used during BOM sync) */
export async function upsertStockItem(itemId: string, quantity: number): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from('stocks')
    .upsert({ item_id: itemId, quantity }, { onConflict: 'item_id' });
  if (error) throw new Error(`upsertStockItem: ${error.message}`);
}

/** Delete a single stock item */
export async function deleteStockItem(itemId: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from('stocks').delete().eq('item_id', itemId);
  if (error) throw new Error(`deleteStockItem: ${error.message}`);
}

// ── Stock Images ──────────────────────────────────────────────────────────────

/** Read all stock images as a flat { item_id: url } map */
export async function readStockImages(): Promise<StockImageMap> {
  const db = getSupabase();
  const { data, error } = await db
    .from('stock_images')
    .select('item_id, image_url');
  if (error) throw new Error(`readStockImages: ${error.message}`);
  const map: StockImageMap = {};
  for (const row of data ?? []) map[row.item_id] = row.image_url;
  return map;
}

/** Overwrite stock images (upsert + delete removed) */
export async function writeStockImages(images: StockImageMap): Promise<void> {
  const db = getSupabase();
  const rows = Object.entries(images).map(([item_id, image_url]) => ({
    item_id,
    image_url,
  }));

  if (rows.length === 0) {
    const { error } = await db.from('stock_images').delete().neq('item_id', '');
    if (error) throw new Error(`writeStockImages(clear): ${error.message}`);
    return;
  }

  const { error: upsertErr } = await db
    .from('stock_images')
    .upsert(rows, { onConflict: 'item_id' });
  if (upsertErr) throw new Error(`writeStockImages(upsert): ${upsertErr.message}`);

  const keepIds = rows.map((r) => r.item_id);
  const { error: delErr } = await db
    .from('stock_images')
    .delete()
    .not('item_id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`);
  if (delErr) throw new Error(`writeStockImages(delete): ${delErr.message}`);
}

/** Upsert a single stock image */
export async function upsertStockImage(itemId: string, imageUrl: string): Promise<void> {
  const db = getSupabase();
  const { error } = await db
    .from('stock_images')
    .upsert({ item_id: itemId, image_url: imageUrl }, { onConflict: 'item_id' });
  if (error) throw new Error(`upsertStockImage: ${error.message}`);
}

// ── Budgets and purchases (see new implementations below) ────────────────────


// ── Budgets ───────────────────────────────────────────────────────────────────

export interface BudgetRow {
  currency: 'THB' | 'G';
  limit_amount: number;
}

/** Read all budget rows (one per currency) */
export async function readBudgets(): Promise<BudgetRow[]> {
  const db = getSupabase();
  const { data, error } = await db.from('budgets').select('currency, limit_amount');
  if (error) throw new Error(`readBudgets: ${error.message}`);
  return (data ?? []) as BudgetRow[];
}

/** Upsert a single budget limit */
export async function upsertBudget(currency: 'THB' | 'G', limit_amount: number): Promise<BudgetRow> {
  const db = getSupabase();
  const { data, error } = await db
    .from('budgets')
    .upsert({ currency, limit_amount }, { onConflict: 'currency' })
    .select('currency, limit_amount')
    .single();
  if (error) throw new Error(`upsertBudget: ${error.message}`);
  return data as BudgetRow;
}

// ── Stock Purchases ───────────────────────────────────────────────────────────

export interface PurchaseRow {
  id: string;
  item_id: string;
  quantity: number;
  total_amount: number;
  currency: 'THB' | 'G';
  source?: string | null;
  contributor?: string | null;
  purchased_at: string;
}

/** Read last 100 purchases ordered by purchased_at desc */
export async function readPurchases(): Promise<PurchaseRow[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('stock_purchases')
    .select('id, item_id, quantity, total_amount, currency, source, contributor, purchased_at')
    .order('purchased_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`readPurchases: ${error.message}`);
  return (data ?? []) as PurchaseRow[];
}

/** Insert a purchase and increment the corresponding stock item */
export async function insertPurchase(p: Omit<PurchaseRow, 'id' | 'purchased_at'>): Promise<PurchaseRow> {
  const db = getSupabase();
  const { data, error } = await db
    .from('stock_purchases')
    .insert({
      item_id:      p.item_id,
      quantity:     p.quantity,
      total_amount: p.total_amount,
      currency:     p.currency,
      source:       p.source ?? null,
      contributor:  p.contributor ?? null,
    })
    .select('id, item_id, quantity, total_amount, currency, source, contributor, purchased_at')
    .single();
  if (error) throw new Error(`insertPurchase: ${error.message}`);

  // Increment stock
  const { data: existing } = await db
    .from('stocks')
    .select('quantity')
    .eq('item_id', p.item_id)
    .single();
  await db.from('stocks').upsert(
    { item_id: p.item_id, quantity: (existing?.quantity ?? 0) + p.quantity },
    { onConflict: 'item_id' }
  );

  return data as PurchaseRow;
}

// ── Floor Timers ──────────────────────────────────────────────────────────────

export interface FloorTimerRow {
  floor_number: number;
  profession?: string | null;
  machine_id?: string | null;
  recipe_id?: string | null;
  status: 'idle' | 'running';
  start_time?: string | null;
  estimated_duration_seconds: number;
  completed_at?: string | null;
}

export async function readFloorTimers(): Promise<FloorTimerRow[]> {
  const db = getSupabase();
  const { data, error } = await db
    .from('floor_timers')
    .select('floor_number, profession, machine_id, recipe_id, status, start_time, estimated_duration_seconds, completed_at')
    .order('floor_number', { ascending: true });
  if (error) throw new Error(`readFloorTimers: ${error.message}`);
  return (data ?? []) as FloorTimerRow[];
}

export async function insertFloorTimer(floor_number: number, profession?: string): Promise<FloorTimerRow> {
  const db = getSupabase();
  const { data, error } = await db
    .from('floor_timers')
    .insert({ floor_number, profession: profession ?? null })
    .select('floor_number, profession, machine_id, recipe_id, status, start_time, estimated_duration_seconds, completed_at')
    .single();
  if (error) throw new Error(`insertFloorTimer: ${error.message}`);
  return data as FloorTimerRow;
}

export async function patchFloorTimer(
  floor_number: number,
  patch: Partial<Omit<FloorTimerRow, 'floor_number'>>
): Promise<FloorTimerRow> {
  const db = getSupabase();
  const { data, error } = await db
    .from('floor_timers')
    .update(patch)
    .eq('floor_number', floor_number)
    .select('floor_number, profession, machine_id, recipe_id, status, start_time, estimated_duration_seconds, completed_at')
    .single();
  if (error) throw new Error(`patchFloorTimer: ${error.message}`);
  return data as FloorTimerRow;
}

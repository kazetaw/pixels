import { AppData, Budget, StockMap, StockImageMap, StockPurchase, TargetItem, CalculateResponse, PlanRequest, PlanResponse, Recipe, FloorTimer } from '../types';

/**
 * Helper to handle fetch responses — throws with server error message on non-OK status.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = body.error ?? errorMsg;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMsg);
  }
  return response.json() as Promise<T>;
}

/** GET /api/data — fetch all recipes, machines, stocks */
export async function fetchAllData(): Promise<AppData> {
  return handleResponse<AppData>(await fetch('/api/data'));
}

/** POST /api/stocks — overwrite stocks.json (and optionally stock_images.json) */
export async function saveStocks(stocks: StockMap, images?: StockImageMap): Promise<void> {
  await handleResponse<{ ok: boolean }>(await fetch('/api/stocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(images !== undefined ? { stocks, images } : stocks),
  }));
}

export async function fetchBudgetData(): Promise<{ budgets: Budget[]; purchases: StockPurchase[] }> {
  return handleResponse(await fetch('/api/budgets'));
}

export async function saveBudget(currency: Budget['currency'], limit_amount: number): Promise<Budget> {
  return handleResponse(await fetch('/api/budgets', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currency, limit_amount }),
  }));
}

export async function createStockPurchase(input: Omit<StockPurchase, 'id' | 'purchased_at'>): Promise<StockPurchase> {
  return handleResponse(await fetch('/api/purchases', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
}

/** POST /api/calculate — BOM calculation */
export async function runCalculation(targets: TargetItem[]): Promise<CalculateResponse> {
  return handleResponse<CalculateResponse>(await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(targets),
  }));
}

/** POST /api/plan — production planner */
export async function runPlan(plan: PlanRequest): Promise<PlanResponse> {
  return handleResponse<PlanResponse>(await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  }));
}

/** GET /api/recipes — list all recipes */
export async function fetchRecipes(): Promise<Recipe[]> {
  return handleResponse<Recipe[]>(await fetch('/api/recipes'));
}

/** POST /api/recipes — create new recipe */
export async function createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
  return handleResponse<Recipe>(await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  }));
}

/** PUT /api/recipes/:id — update recipe */
export async function updateRecipe(id: string, recipe: Partial<Omit<Recipe, 'id'>>): Promise<Recipe> {
  return handleResponse<Recipe>(await fetch(`/api/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  }));
}

/** DELETE /api/recipes/:id — delete recipe */
export async function deleteRecipe(id: string): Promise<void> {
  await handleResponse<{ ok: boolean }>(await fetch(`/api/recipes/${id}`, { method: 'DELETE' }));
}

// ── Diagnose & Migrate ────────────────────────────────────────────────────────

export interface ConflictItem {
  type: 'stock_key' | 'ingredient_ref';
  description: string;
  currentKey: string;
  targetUUID: string;
  recipeName: string;
  currentQty?: number;
}

export interface DiagnoseResult {
  conflicts: ConflictItem[];
  totalConflicts: number;
  isClean: boolean;
}

export interface MigrateResult {
  ok: boolean;
  message: string;
  report: { stocksFixed: string[]; ingredientsFixed: string[]; totalChanges: number };
}

export async function diagnose(): Promise<DiagnoseResult> {
  return handleResponse<DiagnoseResult>(await fetch('/api/diagnose'));
}

export async function migrate(): Promise<MigrateResult> {
  return handleResponse<MigrateResult>(await fetch('/api/migrate', { method: 'POST' }));
}

// ── Machines CRUD ─────────────────────────────────────────────────────────────

import { Machine } from '../types';

export async function fetchMachines(): Promise<Machine[]> {
  return handleResponse<Machine[]>(await fetch('/api/machines'));
}

export async function createMachine(m: Omit<Machine, 'machine_id'>): Promise<Machine> {
  return handleResponse<Machine>(await fetch('/api/machines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  }));
}

export async function updateMachine(id: string, m: Partial<Omit<Machine, 'machine_id'>>): Promise<Machine> {
  return handleResponse<Machine>(await fetch(`/api/machines/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  }));
}

export async function deleteMachine(id: string): Promise<void> {
  await handleResponse<{ ok: boolean }>(await fetch(`/api/machines/${id}`, { method: 'DELETE' }));
}

// ── Image Upload ──────────────────────────────────────────────────────────────

export interface UploadImageResult {
  url: string;
  path: string;
}

/**
 * Upload an image file to Supabase Storage via the /api/upload-image endpoint.
 * @param file    The File object from an <input type="file">
 * @param folder  Sub-folder: "machines" | "recipes" | "stocks"
 * @param itemId  Optional entity id used as filename (auto-generated if omitted)
 */
export async function uploadImage(
  file: File,
  folder: 'machines' | 'recipes' | 'stocks',
  itemId?: string
): Promise<UploadImageResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  if (itemId) form.append('itemId', itemId);

  const response = await fetch('/api/upload-image', { method: 'POST', body: form });
  return handleResponse<UploadImageResult>(response);
}

// ── Factory floor timers ─────────────────────────────────────────────────────

export async function fetchFloorTimers(): Promise<FloorTimer[]> {
  return handleResponse<FloorTimer[]>(await fetch('/api/floors'));
}

export async function createFloorTimer(floor_number: number, profession?: string): Promise<FloorTimer> {
  return handleResponse<FloorTimer>(await fetch('/api/floors', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floor_number, profession }),
  }));
}

export async function updateFloorTimer(floorNumber: number, patch: Partial<FloorTimer>): Promise<FloorTimer> {
  return handleResponse<FloorTimer>(await fetch(`/api/floors/${floorNumber}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  }));
}

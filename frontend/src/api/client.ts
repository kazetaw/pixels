import { AppData, StockMap, TargetItem, CalculateResponse, PlanRequest, PlanResponse, Recipe } from '../types';

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

/** POST /api/stocks — overwrite stocks.json */
export async function saveStocks(stocks: StockMap): Promise<void> {
  await handleResponse<{ ok: boolean }>(await fetch('/api/stocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stocks),
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

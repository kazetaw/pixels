# Design Document

## Feature: Factory Resource Calculator

---

## Overview

A local single-page web application that lets users specify multiple production targets, then computes the net raw-material shopping list and per-machine workload by recursively exploding a multi-tier BOM while deducting per-tier stock. The system is a monorepo containing a React + Vite + TypeScript frontend and a Node.js + Express backend that reads/writes plain JSON files.

---

## Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Browser                                                        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  React SPA (Vite dev server, port 5173)                  â”‚   â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚   â”‚
â”‚  â”‚  â”‚   Sidebar    â”‚    â”‚        Main Panel              â”‚  â”‚   â”‚
â”‚  â”‚  â”‚  - Target    â”‚    â”‚  - Shopping List Table         â”‚  â”‚   â”‚
â”‚  â”‚  â”‚    Items     â”‚    â”‚  - Machine Workload Table      â”‚  â”‚   â”‚
â”‚  â”‚  â”‚  - Stock     â”‚    â”‚                                â”‚  â”‚   â”‚
â”‚  â”‚  â”‚    Editor    â”‚    â”‚                                â”‚  â”‚   â”‚
â”‚  â”‚  â”‚  - Buttons   â”‚    â”‚                                â”‚  â”‚   â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚            â”‚  /api/* (proxied by Vite)                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Node.js + Express (port 3000)                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ GET /api/data  â”‚  â”‚POST /api/stocksâ”‚  â”‚POST /api/calculateâ”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚          â”‚                   â”‚                     â”‚            â”‚
â”‚          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
â”‚                              â”‚                                   â”‚
â”‚                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                       â”‚
â”‚                    â”‚  File I/O Layer    â”‚                       â”‚
â”‚                    â”‚  (fs/promises)     â”‚                       â”‚
â”‚                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â–¼                â–¼                â–¼
       recipes.json      machines.json     stocks.json
       (read-only)       (read-only)       (read/write)
```

---

## Project Structure

```
factory-resource-calculator/
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ App.tsx                  # Root layout: Sidebar + MainPanel
â”‚   â”‚   â”œâ”€â”€ main.tsx
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â””â”€â”€ client.ts            # fetch wrappers for all endpoints
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”œâ”€â”€ Sidebar/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ TargetItemForm.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ TargetItemList.tsx
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ StockEditor.tsx
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ ActionButtons.tsx
â”‚   â”‚   â”‚   â””â”€â”€ MainPanel/
â”‚   â”‚   â”‚       â”œâ”€â”€ ShoppingListTable.tsx
â”‚   â”‚   â”‚       â””â”€â”€ MachineWorkloadTable.tsx
â”‚   â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”‚   â””â”€â”€ useAppState.ts       # all shared state and side-effects
â”‚   â”‚   â””â”€â”€ types/
â”‚   â”‚       â””â”€â”€ index.ts             # shared TypeScript types
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ vite.config.ts               # /api proxy â†’ localhost:3000
â”‚   â”œâ”€â”€ tailwind.config.js
â”‚   â””â”€â”€ tsconfig.json
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ server.ts                # Express app entry point
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”‚   â”œâ”€â”€ data.ts              # GET /api/data
â”‚   â”‚   â”‚   â”œâ”€â”€ stocks.ts            # POST /api/stocks
â”‚   â”‚   â”‚   â””â”€â”€ calculate.ts         # POST /api/calculate
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â”œâ”€â”€ fileStore.ts         # JSON read/write helpers
â”‚   â”‚   â”‚   â””â”€â”€ bomCalculator.ts     # recursive BOM explosion logic
â”‚   â”‚   â””â”€â”€ types/
â”‚   â”‚       â””â”€â”€ index.ts             # shared backend types
â”‚   â”œâ”€â”€ data/
â”‚   â”‚   â”œâ”€â”€ recipes.json
â”‚   â”‚   â”œâ”€â”€ machines.json
â”‚   â”‚   â””â”€â”€ stocks.json
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ tsconfig.json
â”‚
â””â”€â”€ package.json                     # root workspace scripts
```

---

## Data Models

### recipes.json

```json
[
  {
    "id": "steel_beam",
    "name": "Steel Beam",
    "machine_id": "press_a",
    "time_per_unit": 0.5,
    "ingredients": {
      "iron_ore": 3,
      "coal": 1
    }
  }
]
```

### machines.json

```json
[
  {
    "machine_id": "press_a",
    "machine_name": "Press A",
    "floor_number": 3,
    "max_hours_limit": 8
  }
]
```

### stocks.json

```json
{
  "iron_ore": 120,
  "coal": 40,
  "steel_beam": 5
}
```

### TypeScript Types (shared)

```typescript
// types/index.ts

export interface Recipe {
  id: string;
  name: string;
  machine_id: string;
  time_per_unit: number;
  ingredients: Record<string, number>;
}

export interface Machine {
  machine_id: string;
  machine_name: string;
  floor_number: number;
  max_hours_limit: number;
}

export type StockMap = Record<string, number>;

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
}
```

---

## Backend Components

### File Store (`services/fileStore.ts`)

Responsible for all JSON read/write operations. Returns typed data or throws on failure.

```typescript
export async function readRecipes(): Promise<Recipe[]>
export async function readMachines(): Promise<Machine[]>
export async function readStocks(): Promise<StockMap>       // returns {} on missing/empty file
export async function writeStocks(stocks: StockMap): Promise<void>
```

### BOM Calculator (`services/bomCalculator.ts`)

Core business logic. Pure function â€” takes data in, returns results out with no I/O.

#### Algorithm

```
function explode(
  itemId: string,
  quantityNeeded: number,
  recipes: Map<string, Recipe>,
  workingStock: MutableStockMap,   // mutated during session for deduction
  rawAccumulator: Map<string, number>,
  machineHours: Map<string, number>
): void

  1. Deduct available stock for itemId:
       available = workingStock[itemId] ?? 0
       netQty = max(0, quantityNeeded - available)
       workingStock[itemId] = max(0, available - quantityNeeded)

  2. If netQty == 0: return (stock fully covers this tier)

  3. Look up recipe for itemId:
       recipe = recipes.get(itemId)

  4. If no recipe found (raw material / leaf node):
       rawAccumulator[itemId] += netQty
       return

  5. Accumulate machine hours:
       machineHours[recipe.machine_id] += netQty * recipe.time_per_unit

  6. For each (ingredientId, ingredientQty) in recipe.ingredients:
       explode(ingredientId, ingredientQty * netQty, ...)
```

**Note on Simple Deduction**: Stock is deducted at each tier independently. The working stock map is mutated as the algorithm traverses the tree. If an intermediate product has 5 units in stock and 8 are needed, 3 units worth of ingredients will be further exploded â€” but the savings do not propagate back up to reduce the parent tier's ingredient demand.

#### Public API

```typescript
export function calculate(
  targets: TargetItem[],
  recipes: Recipe[],
  machines: Machine[],
  stocks: StockMap
): CalculateResponse
```

### Routes

#### `GET /api/data`

```typescript
// routes/data.ts
router.get('/api/data', async (req, res) => {
  try {
    const [recipes, machines, stocks] = await Promise.all([
      readRecipes(), readMachines(), readStocks()
    ]);
    res.json({ recipes, machines, stocks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data files' });
  }
});
```

#### `POST /api/stocks`

```typescript
// routes/stocks.ts
router.post('/api/stocks', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a stocks map object' });
  }
  await writeStocks(body);
  res.json({ ok: true });
});
```

#### `POST /api/calculate`

```typescript
// routes/calculate.ts
router.post('/api/calculate', async (req, res) => {
  const targets: TargetItem[] = req.body;
  // validate: array, non-empty, each entry has target_item_id and positive target_quantity
  // validate: each target_item_id exists in recipes or is a valid item
  const [recipes, machines, stocks] = await Promise.all([...]);
  const result = calculate(targets, recipes, machines, stocks);
  res.json(result);
});
```

---

## Frontend Components

### `useAppState.ts` (custom hook)

Central state container for the SPA. Exposes:

```typescript
interface AppState {
  // Data
  recipes: Recipe[];
  machines: Machine[];
  stocks: StockMap;

  // Target items
  targetItems: TargetItem[];
  addTargetItem: (item: TargetItem) => void;
  removeTargetItem: (index: number) => void;

  // Stock editor
  updateStock: (itemId: string, qty: number) => void;
  saveStocks: () => Promise<void>;

  // Calculation
  calculate: () => Promise<void>;
  calculationResult: CalculateResponse | null;

  // UI states
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}
```

On mount, the hook calls `GET /api/data` and populates `recipes`, `machines`, and `stocks`.

### `App.tsx`

```tsx
<div className="flex h-screen bg-gray-100">
  <Sidebar />          {/* fixed-width left panel */}
  <MainPanel />        {/* flex-grow right panel */}
</div>
```

### Sidebar Components

**`TargetItemForm.tsx`**
- Dropdown populated from `recipes` (item id â†’ name)
- Numeric input for quantity
- "Add" button â€” disabled when quantity â‰¤ 0, shows inline validation message

**`TargetItemList.tsx`**
- Renders each `TargetItem` as a row: item name + quantity + remove button
- Remove button calls `removeTargetItem(index)`

**`StockEditor.tsx`**
- For each item in `recipes` (and any extra items referenced in stocks), renders a row with the item name and a numeric input bound to `stocks[item.id]`
- `onChange` calls `updateStock(itemId, value)`

**`ActionButtons.tsx`**
- "Save Stocks" button â†’ calls `saveStocks()`; shows spinner while saving, success/error feedback
- "Calculate" button â†’ calls `calculate()`; disabled when `targetItems` is empty; shows spinner while loading

### Main Panel Components

**`ShoppingListTable.tsx`**

| Item Name | Total Needed | Net Required |
|-----------|-------------|-------------|
| Iron Ore  | 240         | 120         |

- Row highlighted with `bg-red-100` when `entry.net_required > (stocks[entry.item_id] ?? 0)`
- All entries rendered, including those with `net_required === 0`

**`MachineWorkloadTable.tsx`**

| Machine Name | Floor | Hours Required | Max Hours |
|-------------|-------|---------------|-----------|
| Press A     | 3     | 12.5          | 8.0       |

- Status indicator: green circle (`bg-green-500`) when `hours_required <= max_hours_limit`, red circle (`bg-red-500`) otherwise
- Only entries returned by the API (non-zero hours) are displayed

---

## API Contract

### `GET /api/data` â†’ 200

```json
{
  "recipes": [ ...Recipe[] ],
  "machines": [ ...Machine[] ],
  "stocks": { "item_id": 0 }
}
```

### `POST /api/stocks` â†’ 200 / 400

Request body: `StockMap`

Success: `{ "ok": true }`
Error: `{ "error": "..." }`

### `POST /api/calculate` â†’ 200 / 400

Request body:
```json
[
  { "target_item_id": "steel_beam", "target_quantity": 10 }
]
```

Success:
```json
{
  "shopping_list": [
    {
      "item_id": "iron_ore",
      "item_name": "Iron Ore",
      "total_needed": 30,
      "net_required": 18
    }
  ],
  "machine_workloads": [
    {
      "machine_id": "press_a",
      "machine_name": "Press A",
      "floor_number": 3,
      "hours_required": 5.0,
      "max_hours_limit": 8.0
    }
  ]
}
```

Error: `{ "error": "..." }`

---

## Error Handling

| Scenario | HTTP Status | Frontend Behavior |
|---|---|---|
| Data files unreadable on `GET /api/data` | 500 | Error banner in main panel |
| Missing/malformed `POST /api/stocks` body | 400 | Error message below Save button |
| Unknown `target_item_id` in `POST /api/calculate` | 400 | Error message in main panel |
| Network failure on any call | â€” (fetch throws) | Error message shown in relevant panel area |
| `stocks.json` missing or empty | 200 (treated as all-zero) | Normal operation |

---

## Vite Proxy Configuration

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system â€” essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Stocks Round-Trip Persistence

*For any* valid stocks map (a key-value map of string item IDs to non-negative numbers), writing it to `stocks.json` via `writeStocks` and then reading it back via `readStocks` SHALL produce an equal map.

**Validates: Requirements 1.3, 3.1**

---

### Property 2: Stock Deduction Invariant

*For any* item with a positive quantity needed and an available stock quantity, the `calculate` function SHALL produce `net_required = max(0, quantity_needed - available_stock)`, and `net_required` SHALL always be less than or equal to `total_needed`.

**Validates: Requirements 4.3, 4.4**

---

### Property 3: Raw-Material Leaf Invariant

*For any* set of target items passed to `calculate`, every entry in the returned `shopping_list` SHALL correspond to an item that has no recipe entry (i.e., it is a leaf node in the BOM tree â€” a true raw material).

**Validates: Requirements 4.2**

---

### Property 4: Machine Hours Accumulation

*For any* calculation result, the `hours_required` for each machine in `machine_workloads` SHALL equal the sum of `net_quantity_produced Ã— time_per_unit` for all recipe steps assigned to that machine during the BOM explosion.

**Validates: Requirements 4.5**

---

### Property 5: Non-Zero Machine Workloads Filter

*For any* calculation result, every entry in `machine_workloads` SHALL have `hours_required` strictly greater than zero. No machine with zero hours SHALL appear in the result.

**Validates: Requirements 4.9**

---

### Property 6: Calculate Response Shape Completeness

*For any* valid `POST /api/calculate` request, every entry in `shopping_list` SHALL contain the fields `item_id`, `item_name`, `total_needed`, and `net_required`; every entry in `machine_workloads` SHALL contain `machine_id`, `machine_name`, `floor_number`, `hours_required`, and `max_hours_limit`.

**Validates: Requirements 4.7, 4.8**

---

### Property 7: Shopping List Row Completeness

*For any* calculation response rendered in the frontend, every row in the Shopping List table SHALL display the Item Name, Total Needed, and Net Required values. The number of rendered rows SHALL equal the number of entries in the `shopping_list` response (including entries with `net_required = 0`).

**Validates: Requirements 9.2, 9.4**

---

### Property 8: Shopping List Shortage Highlighting

*For any* Shopping List table row, a shortage highlight SHALL be applied if and only if `net_required > stocks[item_id]` (treating missing stock as zero).

**Validates: Requirements 9.3**

---

### Property 9: Machine Workload Status Indicator

*For any* Machine Workload table row, a green status indicator SHALL be displayed when `hours_required <= max_hours_limit`, and a red status indicator SHALL be displayed when `hours_required > max_hours_limit`. Exactly one indicator SHALL be active per row.

**Validates: Requirements 10.3, 10.4**

---

### Property 10: Calculate Button Enablement Invariant

*For any* frontend state, the Calculate button SHALL be enabled if and only if the list of target items contains at least one entry.

**Validates: Requirements 6.4**

---

### Property 11: Target Item List Display Completeness

*For any* set of items added to the target item list, every item SHALL appear in the sidebar target item list display with its correct item name and quantity.

**Validates: Requirements 6.2**

---

## Components and Interfaces

### Backend Components

#### `fileStore.ts` — File I/O Service

```typescript
// Reads recipes.json — throws on failure
export async function readRecipes(): Promise<Recipe[]>

// Reads machines.json — throws on failure
export async function readMachines(): Promise<Machine[]>

// Reads stocks.json — returns {} if file is missing or empty (Req 1.4)
export async function readStocks(): Promise<StockMap>

// Overwrites stocks.json atomically
export async function writeStocks(stocks: StockMap): Promise<void>
```

#### `bomCalculator.ts` — BOM Explosion Service

```typescript
// Pure function: no I/O. Accepts all data, returns shopping list + machine workloads.
export function calculate(
  targets: TargetItem[],
  recipes: Recipe[],
  machines: Machine[],
  stocks: StockMap
): CalculateResponse
```

Internal recursive helper (not exported):

```typescript
function explode(
  itemId: string,
  quantityNeeded: number,
  recipeMap: Map<string, Recipe>,
  workingStock: Record<string, number>,  // mutated in-place
  rawNetMap: Map<string, number>,
  rawTotalMap: Map<string, number>,
  machineHoursMap: Map<string, number>
): void
```

#### Express Routes

| File | Method + Path | Handler responsibility |
|---|---|---|
| `routes/data.ts` | `GET /api/data` | Parallel read of all 3 JSON files, return combined payload |
| `routes/stocks.ts` | `POST /api/stocks` | Validate body is non-array object, call `writeStocks` |
| `routes/calculate.ts` | `POST /api/calculate` | Validate targets array, call `calculate`, return result |
| `server.ts` | — | Mount cors, express.json, all routers, listen on port 3000 |

---

### Frontend Components

#### `useAppState.ts` — Central State Hook

| Exported member | Type | Purpose |
|---|---|---|
| `recipes` | `Recipe[]` | Loaded from GET /api/data on mount |
| `machines` | `Machine[]` | Loaded from GET /api/data on mount |
| `stocks` | `StockMap` | Loaded on mount; mutated by `updateStock` |
| `targetItems` | `TargetItem[]` | Managed by `addTargetItem` / `removeTargetItem` |
| `addTargetItem` | `(item: TargetItem) => void` | Appends to targetItems |
| `removeTargetItem` | `(index: number) => void` | Removes by index |
| `updateStock` | `(itemId: string, qty: number) => void` | Updates single stock entry |
| `saveStocks` | `() => Promise<void>` | POST /api/stocks, manages saveStatus |
| `runCalculation` | `() => Promise<void>` | POST /api/calculate, manages loading + result |
| `calculationResult` | `CalculateResponse \| null` | Latest result from API |
| `loading` | `boolean` | True while calculation is in flight |
| `initError` | `string \| null` | Error from initial data load |
| `calcError` | `string \| null` | Error from last calculation |
| `saveStatus` | `'idle' \| 'saving' \| 'saved' \| 'error'` | Tracks stock-save state |
| `saveError` | `string \| null` | Error message from last save attempt |

#### `App.tsx` — Root Layout

```
<div class="flex h-screen">
  <aside class="w-80">          ← Sidebar (fixed width)
    TargetItemForm
    TargetItemList
    StockEditor
    ActionButtons
  </aside>
  <main class="flex-1">         ← Main Panel (flex-grow)
    Error banners (initError / calcError)
    Loading indicator
    ShoppingListTable
    MachineWorkloadTable
    Empty state placeholder
  </main>
</div>
```

#### Sidebar Components

| Component | Props | Behavior |
|---|---|---|
| `TargetItemForm` | `recipes`, `onAdd` | Dropdown + qty input; Add button disabled when qty ≤ 0; inline validation |
| `TargetItemList` | `items`, `recipes`, `onRemove` | Renders each target as a chip; remove button calls `onRemove(index)` |
| `StockEditor` | `recipes`, `stocks`, `onUpdate` | Scrollable list of all items (recipe outputs + ingredients) with number inputs |
| `ActionButtons` | `onSaveStocks`, `onCalculate`, `saveStatus`, `saveError`, `loading`, `canCalculate` | Save Stocks + Calculate buttons with spinners and feedback |

#### Main Panel Components

| Component | Props | Behavior |
|---|---|---|
| `ShoppingListTable` | `entries: ShoppingListEntry[]`, `stocks: StockMap` | Table with Item Name / Total Needed / Net Required / In Stock; `bg-red-50` row when `net_required > stock` |
| `MachineWorkloadTable` | `entries: MachineWorkloadEntry[]` | Table with Status / Machine Name / Floor / Hours / Max / Utilization%; green dot ≤ limit, red dot > limit |

---

### Shared TypeScript Interfaces

```typescript
interface Recipe          { id, name, machine_id, time_per_unit, ingredients }
interface Machine         { machine_id, machine_name, floor_number, max_hours_limit }
type StockMap             = Record<string, number>
interface TargetItem      { target_item_id, target_quantity }
interface ShoppingListEntry    { item_id, item_name, total_needed, net_required }
interface MachineWorkloadEntry { machine_id, machine_name, floor_number, hours_required, max_hours_limit }
interface CalculateResponse    { shopping_list, machine_workloads }
interface AppData         { recipes, machines, stocks }
```

---

## Testing Strategy

### Backend Unit Tests — BOM Calculator

The core `calculate` function in `bomCalculator.ts` is a pure function and can be tested without any file I/O or HTTP. Recommended test cases:

| Test case | Input | Expected output |
|---|---|---|
| Single-tier product, no stock | 1× iron_plate (needs 2× iron_ore) | shopping_list: [{iron_ore, total:2, net:2}] |
| Single-tier product, partial stock | 1× iron_plate, 1× iron_ore in stock | shopping_list: [{iron_ore, total:2, net:1}] |
| Single-tier product, full stock | 1× iron_plate, 2× iron_ore in stock | shopping_list: [{iron_ore, total:2, net:0}] |
| Multi-tier product | 1× engine_part (gear→plate→ore) | all raw materials correctly accumulated |
| Intermediate stock covers branch | 1× engine_part, enough iron_gear in stock | iron_gear branch not exploded further |
| Multiple targets | 2× iron_plate + 1× steel_bar | raw materials correctly aggregated |
| Machine hours accumulation | 2× iron_plate via smelter_f3 (0.5h each) | smelter_f3 hours_required = 1.0 |
| Non-zero workload filter | target fully covered by stock | machine_workloads is empty |

### Backend Unit Tests — File Store

```typescript
// readStocks() returns {} on missing file
// readStocks() returns {} on empty file
// writeStocks then readStocks round-trips identical map
// readRecipes() returns typed Recipe[] from valid JSON
// readMachines() returns typed Machine[] from valid JSON
```

### Backend Integration Tests (optional)

Spin up the Express app with `supertest` and verify:
- `GET /api/data` returns `{ recipes, machines, stocks }` with HTTP 200
- `POST /api/stocks` with valid body returns `{ ok: true }` and persists to file
- `POST /api/stocks` with invalid body returns HTTP 400
- `POST /api/calculate` with valid targets returns correct `shopping_list` and `machine_workloads`
- `POST /api/calculate` with unknown `target_item_id` returns HTTP 400

### Frontend Component Tests (optional)

Using React Testing Library:
- `TargetItemForm`: Add button disabled with qty=0; validation message shown on attempted submit; valid submit calls `onAdd` and resets form
- `TargetItemList`: All items displayed with correct name and qty; remove button calls `onRemove(index)`
- `ShoppingListTable`: Rows highlighted when `net_required > stock`; no highlight when within stock
- `MachineWorkloadTable`: Green dot when `hours_required ≤ max_hours_limit`; red dot when over

### Running Tests

```bash
# Backend — run from backend/
npm test

# Frontend — run from frontend/
npm test
```

> No test framework is pre-configured in this project. To add backend tests, install `jest` + `ts-jest`; for frontend tests, install `vitest` + `@testing-library/react`. Both are optional for the MVP.

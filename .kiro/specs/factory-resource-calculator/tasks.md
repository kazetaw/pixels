# Implementation Plan: Factory Resource Calculator

## Overview

Implement a monorepo web application with a Node.js + Express TypeScript backend and a React + Vite + TypeScript frontend. The backend serves three REST endpoints and computes recursive BOM explosion with per-tier stock deduction. The frontend is a single-page layout with a sidebar for input management and a main panel for results.

## Tasks

- [x] 1. Bootstrap monorepo and project scaffolding
  - [x] 1.1 Create root `package.json` with workspace scripts for `frontend/` and `backend/`
    - Add scripts: `dev:backend`, `dev:frontend`, `build:backend`, `build:frontend`
    - _Requirements: 11.1_

  - [x] 1.2 Scaffold backend project structure
    - Create `backend/package.json` with dependencies: express, cors, ts-node, typescript, @types/express, @types/node, @types/cors
    - Create `backend/tsconfig.json` targeting ESNext/CommonJS
    - Create empty directory stubs: `backend/src/routes/`, `backend/src/services/`, `backend/src/types/`, `backend/data/`
    - _Requirements: 11.1, 11.2_

  - [x] 1.3 Scaffold frontend project structure
    - Create `frontend/` via Vite with the `react-ts` template
    - Install Tailwind CSS, autoprefixer, postcss
    - Configure `tailwind.config.js` and `postcss.config.js`
    - Add `/api` proxy to `vite.config.ts` targeting `http://localhost:3000`
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 2. Define shared TypeScript types
  - [x] 2.1 Create `backend/src/types/index.ts` with all shared backend types
    - Define `Recipe`, `Machine`, `StockMap`, `TargetItem`, `ShoppingListEntry`, `MachineWorkloadEntry`, `CalculateResponse`, `AppData`
    - _Requirements: 1.1, 1.2, 1.3, 4.6, 4.7, 4.8_

  - [x] 2.2 Create `frontend/src/types/index.ts` with all shared frontend types
    - Mirror the same types used in API responses: `Recipe`, `Machine`, `StockMap`, `TargetItem`, `ShoppingListEntry`, `MachineWorkloadEntry`, `CalculateResponse`, `AppData`
    - _Requirements: 5.1, 5.2_

- [x] 3. Create seed data files
  - [x] 3.1 Create `backend/data/recipes.json` with representative multi-tier BOM entries
    - Include at least 5 recipes with varied ingredient trees (raw materials and intermediate products)
    - Ensure every recipe has `id`, `name`, `machine_id`, `time_per_unit`, `ingredients`
    - _Requirements: 1.1_

  - [x] 3.2 Create `backend/data/machines.json` with 27 floor machine entries
    - Each entry has `machine_id`, `machine_name`, `floor_number`, `max_hours_limit`
    - Cover floors 1–27 with at least one machine per floor
    - _Requirements: 1.2_

  - [x] 3.3 Create `backend/data/stocks.json` with an initial empty stocks map `{}`
    - _Requirements: 1.3, 1.4_

- [x] 4. Implement backend file store service
  - [x] 4.1 Create `backend/src/services/fileStore.ts`
    - Implement `readRecipes()`, `readMachines()`, `readStocks()`, `writeStocks()`
    - `readStocks()` must return `{}` when the file is missing or empty
    - Use `fs/promises` for all file operations
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.2 Write property test for stocks round-trip persistence (Property 1)
    - **Property 1: Stocks Round-Trip Persistence**
    - For any valid stocks map written via `writeStocks` and then read back via `readStocks`, the result SHALL equal the original map
    - Use a temp file; clean up after each test
    - **Validates: Requirements 1.3, 3.1**

- [x] 5. Implement BOM calculator service
  - [x] 5.1 Create `backend/src/services/bomCalculator.ts` with the `calculate` function
    - Implement the recursive `explode` inner function using the algorithm from the design
    - Deduct stock at each tier using a mutable working copy of the stock map
    - Accumulate raw material quantities in a flat map; accumulate machine hours per machine
    - Build and return `CalculateResponse` with `shopping_list` and `machine_workloads` (non-zero hours only)
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 5.2 Write property test for stock deduction invariant (Property 2)
    - **Property 2: Stock Deduction Invariant**
    - For any item with a positive quantity needed and available stock, `net_required = max(0, quantity_needed - available_stock)` and `net_required <= total_needed`
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 5.3 Write property test for raw-material leaf invariant (Property 3)
    - **Property 3: Raw-Material Leaf Invariant**
    - Every entry in `shopping_list` SHALL correspond to an item with no recipe (leaf node)
    - Generate random recipe trees and target items; assert no shopping list entry has a recipe
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write property test for machine hours accumulation (Property 4)
    - **Property 4: Machine Hours Accumulation**
    - `hours_required` for each machine SHALL equal `sum(net_qty × time_per_unit)` for all recipe steps on that machine
    - **Validates: Requirements 4.5**

  - [ ]* 5.5 Write property test for non-zero machine workloads filter (Property 5)
    - **Property 5: Non-Zero Machine Workloads Filter**
    - Every entry in `machine_workloads` SHALL have `hours_required > 0`
    - **Validates: Requirements 4.9**

  - [ ]* 5.6 Write property test for calculate response shape completeness (Property 6)
    - **Property 6: Calculate Response Shape Completeness**
    - Every `shopping_list` entry has `item_id`, `item_name`, `total_needed`, `net_required`; every `machine_workloads` entry has `machine_id`, `machine_name`, `floor_number`, `hours_required`, `max_hours_limit`
    - **Validates: Requirements 4.7, 4.8**

- [x] 6. Checkpoint — Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement backend routes and Express server
  - [x] 7.1 Create `backend/src/routes/data.ts` — `GET /api/data`
    - Call `readRecipes`, `readMachines`, `readStocks` in parallel; return combined JSON
    - Return HTTP 500 with error message on any read failure
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.2 Create `backend/src/routes/stocks.ts` — `POST /api/stocks`
    - Validate body is a non-array object; return HTTP 400 on malformed input
    - Call `writeStocks` and return `{ ok: true }` on success
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.3 Create `backend/src/routes/calculate.ts` — `POST /api/calculate`
    - Validate body is a non-empty array with valid `target_item_id` and positive `target_quantity`
    - Return HTTP 400 with descriptive message on invalid input or unknown item IDs
    - Load recipes, machines, stocks; call `calculate`; return result
    - _Requirements: 4.1, 4.6, 4.10_

  - [x] 7.4 Create `backend/src/server.ts` entry point
    - Mount routes, configure `express.json()` middleware, listen on port 3000
    - _Requirements: 11.2_

- [x] 8. Implement frontend API client and state hook
  - [x] 8.1 Create `frontend/src/api/client.ts`
    - Implement `fetchAllData()` → `GET /api/data`
    - Implement `saveStocks(stocks: StockMap)` → `POST /api/stocks`
    - Implement `runCalculation(targets: TargetItem[])` → `POST /api/calculate`
    - All functions throw on non-OK HTTP responses with the server error message
    - _Requirements: 5.2, 7.4, 8.2_

  - [x] 8.2 Create `frontend/src/hooks/useAppState.ts`
    - On mount call `fetchAllData()` and populate `recipes`, `machines`, `stocks`; set `error` on failure
    - Expose `addTargetItem`, `removeTargetItem` (operating on `targetItems` array)
    - Expose `updateStock` for editing individual stock quantities
    - Expose `saveStocks` (calls API, manages `saveStatus` state)
    - Expose `calculate` (calls API, manages `loading` and `calculationResult`)
    - _Requirements: 5.2, 5.3, 6.1–6.5, 7.1–7.6, 8.1–8.5_

- [x] 9. Implement sidebar components
  - [x] 9.1 Create `frontend/src/components/Sidebar/TargetItemForm.tsx`
    - Render a recipe dropdown and a numeric quantity input
    - "Add" button disabled when quantity ≤ 0; inline validation message on invalid submit attempt
    - Calls `addTargetItem` on valid submit and resets the form
    - _Requirements: 6.1, 6.5_

  - [ ]* 9.2 Write unit tests for `TargetItemForm` validation behavior
    - Test: button disabled with quantity = 0; validation message shown; valid submit calls handler
    - _Requirements: 6.5_

  - [x] 9.3 Create `frontend/src/components/Sidebar/TargetItemList.tsx`
    - Render each target item as a row: item name, quantity, remove button
    - Remove button calls `removeTargetItem(index)`
    - _Requirements: 6.2, 6.3_

  - [ ]* 9.4 Write property test for target item list display completeness (Property 11)
    - **Property 11: Target Item List Display Completeness**
    - For any set of items added to the list, every item SHALL appear with correct name and quantity
    - **Validates: Requirements 6.2**

  - [x] 9.5 Create `frontend/src/components/Sidebar/StockEditor.tsx`
    - Render a scrollable list of items (from recipes) with the item name and a numeric input bound to `stocks[item.id]`
    - `onChange` calls `updateStock(itemId, value)`
    - _Requirements: 7.1, 7.2_

  - [x] 9.6 Create `frontend/src/components/Sidebar/ActionButtons.tsx`
    - "Save Stocks" button: spinner while `saveStatus === 'saving'`; success/error feedback; calls `saveStocks()`
    - "Calculate" button: disabled when `targetItems` is empty; spinner while `loading`; calls `calculate()`
    - _Requirements: 6.4, 7.3, 7.4, 8.1, 8.3_

  - [ ]* 9.7 Write property test for Calculate button enablement invariant (Property 10)
    - **Property 10: Calculate Button Enablement Invariant**
    - Calculate button SHALL be enabled iff `targetItems.length >= 1`
    - **Validates: Requirements 6.4**

- [x] 10. Implement main panel components
  - [x] 10.1 Create `frontend/src/components/MainPanel/ShoppingListTable.tsx`
    - Render table with columns: Item Name, Total Needed, Net Required
    - Highlight row with `bg-red-100` when `net_required > (stocks[item_id] ?? 0)`
    - Render all entries including those with `net_required === 0`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 10.2 Write property test for shopping list row completeness (Property 7)
    - **Property 7: Shopping List Row Completeness**
    - Number of rendered rows SHALL equal number of entries in `shopping_list` response; each row displays Item Name, Total Needed, Net Required
    - **Validates: Requirements 9.2, 9.4**

  - [ ]* 10.3 Write property test for shopping list shortage highlighting (Property 8)
    - **Property 8: Shopping List Shortage Highlighting**
    - A shortage highlight SHALL be applied if and only if `net_required > stocks[item_id]` (treating missing stock as 0)
    - **Validates: Requirements 9.3**

  - [x] 10.4 Create `frontend/src/components/MainPanel/MachineWorkloadTable.tsx`
    - Render table with columns: Machine Name, Floor, Hours Required, Max Hours Limit, Status
    - Green circle (`bg-green-500`) when `hours_required <= max_hours_limit`; red circle (`bg-red-500`) otherwise
    - Render only entries returned by the API
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 10.5 Write property test for machine workload status indicator (Property 9)
    - **Property 9: Machine Workload Status Indicator**
    - Green indicator shown iff `hours_required <= max_hours_limit`; red iff `hours_required > max_hours_limit`; exactly one active per row
    - **Validates: Requirements 10.3, 10.4**

- [x] 11. Wire everything together in `App.tsx`
  - [x] 11.1 Create `frontend/src/App.tsx` with two-panel layout
    - `useAppState` provides all props threaded down to `Sidebar` and `MainPanel`
    - Sidebar (fixed width): `TargetItemForm`, `TargetItemList`, `StockEditor`, `ActionButtons`
    - MainPanel (flex-grow): error banner on load failure; loading indicator during calculation; `ShoppingListTable` and `MachineWorkloadTable` after successful calculation
    - _Requirements: 5.1, 5.2, 5.3, 8.3, 8.4, 8.5_

  - [ ]* 11.2 Write integration test for full calculate flow
    - Mock `POST /api/calculate` response; verify `ShoppingListTable` and `MachineWorkloadTable` are rendered with correct data
    - _Requirements: 8.4_

- [-] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The backend can be started with `ts-node src/server.ts` or a compiled `node dist/server.js` from the `backend/` directory
- The frontend dev server can be started with `npm run dev` from the `frontend/` directory

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["7.4", "8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["9.1", "9.3", "9.5", "9.6", "10.1", "10.4"] },
    { "id": 8, "tasks": ["9.2", "9.4", "9.7", "10.2", "10.3", "10.5"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```

# Requirements Document

## Introduction

A local web application for calculating factory resource requirements and machine workloads during a factory management game event. The factory has 27 floors, each containing machines. Production is modeled using multi-tier Bill of Materials (BOM) recipes. Users specify multiple target items with quantities, and the system performs recursive BOM explosion, deducts intermediate product stocks at each tier, and returns a net shopping list and per-machine workload summary — all in a single-page interface.

## Glossary

- **System**: The factory-resource-calculator web application as a whole.
- **Frontend**: The React + Vite + TypeScript single-page application served to the browser.
- **Backend**: The Node.js + Express HTTP server running on port 3000.
- **BOM (Bill of Materials)**: A multi-tier recipe tree that defines the ingredients (raw materials or intermediate products) required to produce one unit of an item.
- **Recipe**: A production specification with an id, name, machine_id, time_per_unit (hours), and an ingredients map of item_id to quantity.
- **Machine**: A production machine identified by machine_id, located on a specific floor_number, with a machine_name and a max_hours_limit.
- **Stock**: The current available quantity for each item, persisted in stocks.json as a key-value map of item_id to quantity.
- **Raw Material**: An ingredient that has no recipe (leaf node in the BOM tree).
- **Intermediate Product**: An ingredient that itself has a recipe and can be partially or fully satisfied from stock before further BOM explosion.
- **Target Item**: A user-specified production goal consisting of a target_item_id and a target_quantity.
- **Shopping List**: The aggregated net quantities of raw materials still needed after stock deduction.
- **Machine Workload**: The total production hours accumulated on a given machine across all items being produced in a calculation session.
- **Calculation Session**: A single invocation of POST /api/calculate covering all target items submitted together.
- **Simple Deduction**: Subtraction of available stock from the required quantity at each tier independently, without propagating raw-material savings upward through the recipe tree.

---

## Requirements

### Requirement 1: Data Persistence via Local JSON Files

**User Story:** As a developer, I want all application data stored in local JSON files, so that the application runs without any external database dependency.

#### Acceptance Criteria

1. THE Backend SHALL read recipe data from `backend/data/recipes.json`, where each entry contains `id`, `name`, `machine_id`, `time_per_unit` (hours), and `ingredients` (key-value map of item_id to quantity).
2. THE Backend SHALL read machine data from `backend/data/machines.json`, where each entry contains `machine_id`, `floor_number`, `machine_name`, and `max_hours_limit`.
3. THE Backend SHALL read and write stock data from `backend/data/stocks.json`, where the file contains a key-value map of item_id to quantity.
4. IF `backend/data/stocks.json` does not exist or is empty, THEN THE Backend SHALL treat all item stock quantities as zero.

---

### Requirement 2: Backend API — Fetch All Data

**User Story:** As a frontend developer, I want a single endpoint to retrieve all reference data, so that the Frontend can bootstrap without multiple round trips.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/data` that returns a JSON response containing the full contents of `recipes.json`, `machines.json`, and `stocks.json` in a single payload.
2. WHEN `GET /api/data` is requested, THE Backend SHALL respond with HTTP 200 and a JSON object with keys `recipes`, `machines`, and `stocks`.
3. IF any data file cannot be read, THEN THE Backend SHALL respond with HTTP 500 and a JSON error message.

---

### Requirement 3: Backend API — Update Stocks

**User Story:** As a user, I want to save my current stock quantities to the server, so that subsequent calculations reflect accurate on-hand inventory.

#### Acceptance Criteria

1. THE Backend SHALL expose `POST /api/stocks` that accepts a JSON body containing the complete stocks key-value map (item_id to quantity).
2. WHEN `POST /api/stocks` is called with a valid body, THE Backend SHALL overwrite `backend/data/stocks.json` with the provided data and respond with HTTP 200.
3. IF the request body is missing or malformed, THEN THE Backend SHALL respond with HTTP 400 and a descriptive error message.

---

### Requirement 4: Backend API — BOM Calculation

**User Story:** As a user, I want the backend to perform recursive BOM explosion and stock deduction, so that I receive an accurate net shopping list and machine workloads.

#### Acceptance Criteria

1. THE Backend SHALL expose `POST /api/calculate` that accepts a JSON body containing an array of objects, each with `target_item_id` and `target_quantity`.
2. WHEN `POST /api/calculate` is called, THE Backend SHALL perform recursive BOM explosion for each target item, traversing the recipe tree until all leaf nodes (raw materials) are reached.
3. WHILE performing BOM explosion at each tier, THE Backend SHALL apply simple deduction: subtract the available stock quantity from the required quantity for that tier's item, using the remaining (net) quantity for further explosion. The deduction SHALL NOT propagate raw-material savings upward through the recipe tree.
4. WHEN stock for an intermediate product at any tier is sufficient to cover the required quantity, THE Backend SHALL stop further explosion of that branch.
5. THE Backend SHALL accumulate production time per machine by multiplying the net quantity produced by `time_per_unit` and summing across all items assigned to that machine.
6. WHEN `POST /api/calculate` is called with a valid body, THE Backend SHALL respond with HTTP 200 and a JSON object containing `shopping_list` (array of net raw material items) and `machine_workloads` (array of machine workload entries for machines with non-zero hours).
7. THE `shopping_list` response SHALL include, for each raw material: `item_id`, `item_name`, `total_needed` (gross quantity before stock deduction), and `net_required` (quantity after stock deduction).
8. THE `machine_workloads` response SHALL include, for each used machine: `machine_id`, `machine_name`, `floor_number`, `hours_required`, and `max_hours_limit`.
9. THE Backend SHALL include in `machine_workloads` only machines that have `hours_required` greater than zero.
10. IF the request body is missing, malformed, or contains an unknown `target_item_id`, THEN THE Backend SHALL respond with HTTP 400 and a descriptive error message.

---

### Requirement 5: Frontend — Application Layout

**User Story:** As a user, I want a clear two-panel layout, so that I can manage inputs on one side and view results on the other without navigating away.

#### Acceptance Criteria

1. THE Frontend SHALL render a persistent sidebar panel containing all input controls and a main panel containing calculation results on the same page.
2. THE Frontend SHALL fetch all data from `GET /api/data` on application load and populate the sidebar controls with the retrieved data.
3. IF the data fetch fails on load, THEN THE Frontend SHALL display an error message to the user within the main panel.

---

### Requirement 6: Frontend — Target Item Management

**User Story:** As a user, I want to add and remove multiple target items with individual quantities, so that I can calculate production requirements for an entire batch in one session.

#### Acceptance Criteria

1. THE Frontend SHALL provide an interface in the sidebar for users to add a target item by selecting an item from a dropdown and entering a positive integer quantity.
2. THE Frontend SHALL display all added target items as a list in the sidebar, each showing the item name and quantity.
3. WHEN a user clicks the remove control for a target item entry, THE Frontend SHALL remove that entry from the list.
4. THE Frontend SHALL allow at least one target item to be present before enabling the Calculate button.
5. IF a user attempts to add a target item with a quantity less than or equal to zero, THEN THE Frontend SHALL prevent the addition and display a validation message.

---

### Requirement 7: Frontend — Stock Editor

**User Story:** As a user, I want to view and edit stock quantities for all items in the sidebar, so that I can keep the inventory current before running a calculation.

#### Acceptance Criteria

1. THE Frontend SHALL display an editable stock list in the sidebar showing each item's name and its current stock quantity.
2. WHEN a user modifies a stock quantity field, THE Frontend SHALL update the displayed value immediately in the UI.
3. THE Frontend SHALL provide a "Save Stocks" button in the sidebar.
4. WHEN the user clicks "Save Stocks", THE Frontend SHALL send the current stock values to `POST /api/stocks`.
5. WHEN `POST /api/stocks` returns HTTP 200, THE Frontend SHALL display a success confirmation to the user.
6. IF `POST /api/stocks` returns an error, THEN THE Frontend SHALL display an error message to the user.

---

### Requirement 8: Frontend — Calculation Trigger

**User Story:** As a user, I want to trigger a full BOM calculation with one click, so that I can see results for all target items simultaneously.

#### Acceptance Criteria

1. THE Frontend SHALL provide a "Calculate" button in the sidebar.
2. WHEN the user clicks "Calculate", THE Frontend SHALL send all current target items as an array of `{target_item_id, target_quantity}` to `POST /api/calculate`.
3. WHILE the calculation request is in progress, THE Frontend SHALL display a loading indicator.
4. WHEN `POST /api/calculate` returns a successful response, THE Frontend SHALL render the results in the main panel on the same page, replacing any previous results.
5. IF `POST /api/calculate` returns an error, THEN THE Frontend SHALL display a descriptive error message in the main panel.

---

### Requirement 9: Frontend — Shopping List Display

**User Story:** As a user, I want to see a shopping list table of raw materials needed, so that I know exactly what to procure.

#### Acceptance Criteria

1. THE Frontend SHALL render a Shopping List table in the main panel after a successful calculation.
2. THE Shopping List table SHALL display the following columns for each raw material: Item Name, Total Needed, and Net Required.
3. WHEN `net_required` for a raw material exceeds the available stock quantity, THE Frontend SHALL highlight that row to indicate a shortage.
4. THE Frontend SHALL display all raw materials returned in the `shopping_list` response, including those with zero net required quantity.

---

### Requirement 10: Frontend — Machine Workload Display

**User Story:** As a user, I want to see a machine workload table, so that I can identify which machines are overloaded during the event.

#### Acceptance Criteria

1. THE Frontend SHALL render a Machine Workload table in the main panel after a successful calculation.
2. THE Machine Workload table SHALL display the following columns for each used machine: Machine Name, Floor, Hours Required, and Max Hours Limit.
3. WHEN `hours_required` for a machine is less than or equal to `max_hours_limit`, THE Frontend SHALL display that machine's row with a green status indicator.
4. WHEN `hours_required` for a machine exceeds `max_hours_limit`, THE Frontend SHALL display that machine's row with a red status indicator.
5. THE Frontend SHALL display only machines returned in the `machine_workloads` response (machines with non-zero hours).

---

### Requirement 11: Project Structure and Build

**User Story:** As a developer, I want the project structured as a monorepo with separate frontend and backend folders, so that each part can be developed and run independently.

#### Acceptance Criteria

1. THE System SHALL be organized with a `frontend/` directory containing the React + Vite + TypeScript application and a `backend/` directory containing the Node.js + Express server.
2. THE Backend SHALL listen on port 3000.
3. THE Frontend development server SHALL proxy API requests prefixed with `/api` to the Backend at port 3000, so that the Frontend can be developed without CORS configuration.
4. THE Frontend SHALL be built using Vite with TypeScript (TSX) support and styled with Tailwind CSS.

# Implementation Plan

## Codebase findings

### Task 1 — key facts
- `stockItemVisual(id, name)` already exists inside `Withdrawals` (line ~349 in the component). It builds a `<span className="withdrawal-stock-option">` that contains `<ItemLabel>` on the left and a count span on the right.
- The count currently reads **"หมดสต็อก"** when `available <= 0` and **"เบิกได้ N ชิ้น"** otherwise.
- The task spec says: show **"หมด"** (not "หมดสต็อก") in red, and show the count in grey/muted-blue (#64748b) when available > 0.
- The CSS classes `.withdrawal-stock-option` and `.withdrawal-stock-option__count.is-empty` **already exist** in `src/index.css` (lines 1867–1871). The non-empty count colour is currently `#15803d` (green). Task 1 requires changing it to `#64748b`.
- The user-form `<Select>` that renders items already calls `optionRender={option => stockItemVisual(...)}`  and `labelRender={({ value, label }) => stockItemVisual(...)}` **inline** (it does not use `withdrawalItemVisuals`). So no factory refactor is needed — the `stockItemVisual` function already captures `availability` from closure.
- The admin toolbar `<Select>` uses `{...withdrawalItemVisuals}` which renders a plain `<ItemLabel>`. That Select must remain unchanged.

### Task 2 — key facts
- `AppData` shape: `{ recipes, machines, stocks: Record<item_id,number>, stockImages: Record<item_id,string>, itemNames: Record<item_id,string> }`.
- `fetchAllData()` from `api/client.ts` returns `AppData` — everything needed.
- `isInventoryPath` pattern in `App.tsx`: a const function + a `useState` gated with `if (publicInventory)` early return.
- The budget PIN dot-circle widget is in `DataEditor.tsx` lines ~44–113: 4 `<input type="password" inputMode="numeric">` rendered absolutely inside a `<div>` with a visible circle behind each, filled when a digit is present. No `BudgetPinModal` is used in DataEditor — that file is a separate older component; the inline pattern is what to replicate.
- No `Store` folder exists yet under `src/components/`.
- No `store-` CSS classes exist yet in `index.css`.
- TypeScript is strict: `noUnusedLocals`, `noUnusedParameters` — every variable and parameter must be used.

---

## Plan

- [ ] 1. Fix `withdrawal-stock-option__count` text and colour in `stockItemVisual`.

  The function lives inside `Withdrawals.tsx`. Two changes:
  1. Change the displayed text for `available <= 0` from `'หมดสต็อก'` to `'หมด'`.
  2. Change the CSS rule `.withdrawal-stock-option__count` in `src/index.css` (line 1869) from `color: #15803d` to `color: #64748b` so non-empty counts render in muted blue-grey.

  No structural refactor is needed. The user-form `<Select>` already calls `stockItemVisual` inline; the admin toolbar `<Select>` already uses `withdrawalItemVisuals` and is not touched.

  Files:
  - `src/components/Withdrawals/Withdrawals.tsx`
  - `src/index.css`

  Verify: `cd /Users/thanchira.m/Documents/ChatGPT/Test-logic/pixels/frontend && npx tsc --noEmit --skipLibCheck` — zero errors.

---

- [ ] 2. Create `src/components/Store/StorePage.tsx`.

  Implement the full store page as a self-contained component. Detailed spec:

  **Types (declare at top of file, not exported to avoid unused-export lint issues):**
  ```ts
  type SaleRecord = {
    id: string; item_id: string; item_name: string;
    qty: number; price_per_unit: number; total: number; sold_at: string;
  };
  type RestockRecord = {
    id: string; item_id: string; item_name: string;
    qty: number; note: string; restocked_at: string;
  };
  ```

  **PIN gate:**
  - STORE_PIN constant = `'3333'`, PIN_LENGTH = 4
  - localStorage key: `store-pin-verified` → check `=== '1'` on mount; set to `'1'` on success
  - Use the same dot-circle pattern as `DataEditor.tsx`: four `<input type="password" inputMode="numeric" maxLength={1}>` each absolutely positioned inside a 52×52 div with a circle behind it. Filled circle (`width:12,height:12,borderRadius:'50%',background:'#4f46e5'`) when digit present, error state in `#ef4444`. Auto-focus first input; on digit entry advance focus; on Backspace retreat focus. On 4th digit complete: verify → set localStorage + state or show error + clear after 600 ms.

  **Data loading:**
  - `useEffect` on mount: call `fetchAllData()`. Store result in state: `apiData: AppData | null`.
  - Parse localStorage:
    - `store-prices`: `JSON.parse(localStorage.getItem('store-prices') ?? '{}')` → `Record<string, number>`, state `prices`
    - `store-sales`: array of `SaleRecord`, state `sales`
    - `store-restocks`: array of `RestockRecord`, state `restocks`
  - `localStock: Record<string, number>` — state initialised from `apiData.stocks` when apiData loads (use `useEffect([apiData])` to set it once). Sales and restocks modify it in place during the session. Not persisted to API.

  **Helpers:**
  - `savePrice(itemId, price)`: update `prices` state + write `store-prices` to localStorage
  - `addSale(saleRecord)`: prepend to `sales` + write `store-sales` + decrement `localStock[item_id]`
  - `addRestock(restockRecord)`: prepend to `restocks` + write `store-restocks` + increment `localStock[item_id]`
  - `deleteSale(id)`: remove from `sales` + write `store-sales` (do NOT adjust `localStock` — it reflects current session only)

  **Layout: own top navbar, 3 tabs**
  - Navbar: fixed top bar, indigo background (`#4f46e5`), white text, title "ร้านค้า" on left; 3 tab buttons centred or inline — ภาพรวม / เติมสต็อก / บันทึกการขาย.
  - Active tab button: white background with indigo text; inactive: transparent with white text, subtle hover.

  **Tab 1 — ภาพรวม:**
  - Summary row: 3 `<Card>` or plain styled divs:
    - "สินค้าทั้งหมด" = count of items in `localStock` where `value > 0`
    - "สต็อกรวม" = sum of all `localStock` values
    - "ยอดขายรวม" = sum of `sales.map(s => s.total)`, formatted as number
  - Product grid: CSS grid, 2 columns on mobile, 3+ on wider screens. One card per item in `apiData.itemNames`. Each card:
    - Item image (`stockImages[id]`) or fallback icon
    - Item name
    - Stock qty — red if `localStock[id] <= 0`, else normal
    - Price: Ant Design `<InputNumber>` (min 0, precision 0), value = `prices[id] ?? 0`, `onChange` calls `savePrice(id, val)`
    - "ขายไป" `<Button>` — disabled if `localStock[id] <= 0`; on click opens sell modal for that item.
  - Sell modal (`<Modal>`): title = item name; `<InputNumber>` qty min=1 max=`localStock[id]`; confirm → compute total, call `addSale`, close modal.

  **Tab 2 — เติมสต็อก:**
  - Form at top: `<Select showSearch>` for item (options from `apiData.itemNames`), `<InputNumber>` qty (min 1), `<Input>` note. "เพิ่มสต็อก" `<Button>` → call `addRestock`, clear form.
  - Restock history: list of `restocks` below form — each row shows: date/time, item image+name, qty, note (if any).

  **Tab 3 — บันทึกการขาย:**
  - Total revenue (`sum of sales.total`) shown above table as a stat.
  - Ant Design `<Table>` with columns:
    - วันที่/เวลา: `sold_at` formatted with `toLocaleString('th-TH')`
    - สินค้า: item image + name (use `<ItemLabel>` from shared/ItemVisual if possible, or inline image+text)
    - จำนวน: `qty`
    - ราคา/หน่วย: `price_per_unit` (no locale TH, just number)
    - รวม: `total`
    - ลบ: `<Button danger size="small">` → `deleteSale(record.id)`
  - `dataSource={sales}`, `rowKey="id"`, `pagination={{ pageSize: 20 }}`

  **ItemVisualProvider note:** `StorePage` does NOT wrap itself in `ItemVisualProvider` — it is rendered before the main app. Use direct `stockImages[id]` references for images (inline `<img>` or `<Avatar>`), not `useItemImage`. This avoids needing the context and recipes/machines props.

  Files:
  - `src/components/Store/StorePage.tsx` (create)

  Verify: `npx tsc --noEmit --skipLibCheck` — zero errors.

---

- [ ] 3. Register the `/store` route in `App.tsx`.

  After the `publicInventory` block (around line 496 in App.tsx), add:

  ```tsx
  const isStorePath = () => window.location.pathname.replace(/\/+$/, '') === '/store';
  if (isStorePath()) {
    return <StorePage />;
  }
  ```

  Add `import { StorePage } from './components/Store/StorePage';` at the top of the file alongside the other imports. Do NOT add StorePage to the sidebar nav arrays `ADMIN_VIEWS` / `PUBLIC_VIEWS` / `NAV_ITEMS`.

  Files:
  - `src/App.tsx`

  Verify: `npx tsc --noEmit --skipLibCheck` — zero errors.

---

- [ ] 4. Add `store-` CSS classes to `index.css`.

  Append at the end of `src/index.css`. Include:

  ```css
  /* ── Store page ─────────────────────────────────────────────────────────── */
  .store-page { min-height: 100vh; background: #f8fafc; padding-top: 56px; }
  .store-navbar { position: fixed; top: 0; left: 0; right: 0; height: 56px; background: #4f46e5; display: flex; align-items: center; padding: 0 16px; gap: 0; z-index: 100; }
  .store-navbar__title { font-size: 15px; font-weight: 700; color: #fff; margin-right: 20px; white-space: nowrap; }
  .store-navbar__tabs { display: flex; gap: 4px; }
  .store-navbar__tab { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); background: transparent; transition: background 0.15s, color 0.15s; }
  .store-navbar__tab:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .store-navbar__tab.is-active { background: #fff; color: #4f46e5; }

  .store-pin-gate { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 20px; background: #f8fafc; }
  .store-pin-dots { display: flex; gap: 14px; }

  .store-summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
  .store-summary-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
  .store-summary-card__value { font-size: 24px; font-weight: 700; color: #4f46e5; }
  .store-summary-card__label { font-size: 12px; color: #64748b; margin-top: 4px; }

  .store-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; padding: 0 16px 24px; }
  .store-product-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .store-product-card__img { width: 56px; height: 56px; object-fit: contain; border-radius: 6px; }
  .store-product-card__img-placeholder { width: 56px; height: 56px; border-radius: 6px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #cbd5e1; }
  .store-product-card__name { font-size: 13px; font-weight: 600; color: #0f172a; text-align: center; line-height: 1.3; }
  .store-product-card__qty { font-size: 12px; color: #64748b; }
  .store-product-card__qty.is-empty { color: #dc2626; font-weight: 600; }

  .store-restock-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; padding: 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
  .store-restock-list { padding: 0 16px; }
  .store-restock-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .store-restock-row__meta { flex: 1; min-width: 0; }
  .store-restock-row__time { font-size: 11px; color: #94a3b8; }
  .store-restock-row__note { font-size: 12px; color: #64748b; margin-top: 2px; }

  .store-tab-content { padding-top: 8px; }
  .store-revenue-stat { padding: 16px; font-size: 15px; font-weight: 600; color: #0f172a; }
  .store-revenue-stat span { color: #4f46e5; font-size: 20px; margin-left: 8px; }

  @media (max-width: 480px) {
    .store-summary-row { grid-template-columns: 1fr 1fr; }
    .store-product-grid { grid-template-columns: repeat(2, 1fr); }
    .store-navbar__title { display: none; }
    .store-restock-form { flex-direction: column; }
    .store-restock-form > * { width: 100%; }
  }
  ```

  Files:
  - `src/index.css`

  Verify: `npx tsc --noEmit --skipLibCheck` — zero errors (CSS change cannot break TS, but run after step 3 to confirm accumulated state is clean).

---

- [ ] 5. Final verification, commit, and push.

  From `/Users/thanchira.m/Documents/ChatGPT/Test-logic/pixels/frontend/`:
  ```
  npx tsc --noEmit --skipLibCheck
  ```
  Must produce zero errors. If any errors exist, fix them before committing.

  Then from the repo root `/Users/thanchira.m/Documents/ChatGPT/Test-logic/pixels/`:
  ```
  git add frontend/src/components/Withdrawals/Withdrawals.tsx \
          frontend/src/components/Store/StorePage.tsx \
          frontend/src/App.tsx \
          frontend/src/index.css
  git commit -m "feat: withdrawal stock qty in select + /store page"
  git push origin main
  ```

  Report the commit hash.

---

## Summary of key decisions

**Task 1:** `stockItemVisual` already exists and already closes over `availability`, so no factory refactor is needed. Only two changes: (a) change the "หมดสต็อก" string to "หมด" in the JSX, and (b) change the CSS colour for `.withdrawal-stock-option__count` from `#15803d` to `#64748b`. The admin toolbar select is untouched.

**Task 2:** `StorePage` does not nest inside `ItemVisualProvider` (that context requires recipes/machines which the store page would need to fetch just for images it already has via `stockImages`). Images are rendered with a plain `<img>` using `stockImages[id]`. The PIN gate replicates the DataEditor dot-circle pattern exactly. `localStock` is local session state, never pushed to the API. All persistent data (prices, sales, restocks) lives in localStorage.

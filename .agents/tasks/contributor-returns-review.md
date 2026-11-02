# จ่ายคืน — Contributor Return Tracking

This change adds a full feature for tracking stock return disbursements: a `contributor_returns` table in Supabase, three new API routes, a two-tab React component, and the App.tsx wiring to expose it in the admin nav. The approach mirrors the `assignment-summary` pattern and integrates cleanly with existing `stock_purchases` data to derive who has outstanding stock yet to be returned.

**Watch for:**
- **confirmed** — `ContributorReturn.qty` vs `quantity` type mismatch: the types file declares `qty: number` but the component reads `dataIndex: 'qty'` while the plan specified `quantity`. The API GET returns `qty` (matching the DB column), so the type and API are consistent, but `createContributorReturn` sends `{ qty }` while the plan's Step 4 shows `{ quantity }` — see details below.
- **confirmed** — `pending_qty` can go negative when returned_qty > contributed_qty; the API does not clamp it.
- **confirmed** — The migration drops the `100`-char length constraint from the plan (`check (length(trim(contributor)) between 1 and 100)`) in favor of `check (length(trim(contributor)) > 0)`, meaning extremely long contributor names that pass API validation will be rejected by the API but accepted by the DB check, which is safe but inconsistent.
- **confirmed** — The `returned_at desc` index from the plan was replaced by an `item_id` index; there is no index on `returned_at`, impacting sort performance as the table grows.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The `contributor_returns` table is straightforward. The column is named `qty` (not `quantity` as the plan specified), which cascades through the API and types consistently — but the frontend POST payload and the client helper use `qty` while the form field internally uses `qty` too, so the wire format is coherent. The only place the plan/implementation diverge visibly for callers is the field name itself.

The `GET /api/contributor-summary` route aggregates `stock_purchases` and `contributor_returns` into per-contributor, per-item totals. The `pending_qty` formula (`contributed_qty - returned_qty`) is applied incrementally as rows are processed, but the final total is correctly re-derived from the item-level totals using separate `total_contributed` and `total_returned` sums, so the top-level totals are always consistent with the item breakdown. The incremental `pending_qty` update during the loop is redundant but not wrong.

The `GET /api/contributor-returns` join uses `items(name, image_url)` via Supabase's implicit FK join — this works because `item_id` references `public.items(item_id)`, and the relationship is defined in the migration. The `POST` validates contributor name length (≤100 chars) and item existence before inserting, which is the right level of strictness for an admin-only endpoint.

The component correctly passes `summaryData` down to `RecordTab`, so the item dropdown is populated from live summary data without a redundant second fetch. The pending-item chips in `RecordTab` pre-fill both the item select and the quantity field, which is a useful shortcut. The history table filters client-side by the selected contributor, which is fine given the 200-row cap.

The `ContributorReturns` component is only rendered when `isAdmin && view === 'contributor-returns'`, which keeps it out of the public view. `GiftOutlined` is imported and used correctly. `ADMIN_VIEWS` and `MainView` union type both include `'contributor-returns'`.

---

<details>
<summary>Issues (4)</summary>

1. **`pending_qty` goes negative without clamping** — If `returned_qty > contributed_qty` (e.g., a data entry error), `pending_qty` becomes negative. The API returns the raw negative value; the component renders it as a red number, which is confusing. Clamp to `Math.max(0, contributed_qty - returned_qty)` in the API, or add a separate `over_returned` flag and display it differently.

2. **No `returned_at` index on `contributor_returns`** — The migration creates indexes on `contributor` and `item_id` but not on `returned_at`. The `GET` query orders by `returned_at DESC`, so without this index a full table scan occurs on every page load. The plan specified this index explicitly (`contributor_returns_returned_at_idx`). Add it.

3. **`createContributorReturn` payload field `qty` vs form field naming** — The client helper (`client.ts`) sends `{ qty }` in the POST body, and the API expects `qty`. This is consistent. However, `ContributorReturns.tsx` uses `form.getFieldValue('qty')` via `Form.useForm<ReturnFormValues>()` where `ReturnFormValues.qty` is typed as `number`, and the submit handler passes `values.qty`. This is all consistent internally — but the plan's Step 4 interface used `quantity` as the payload field, and the component's form field name (`qty`) would cause a mismatch if anyone follows the plan for a future integration. Not a runtime bug, but a spec drift that should be documented.

4. **Overly permissive `contributor` DB constraint** — The migration uses `check (length(trim(contributor)) > 0)` with no upper bound. The API correctly caps at 100 chars, but a direct DB insert or a future migration that bypasses the API can insert arbitrarily long strings. Add `check (length(trim(contributor)) between 1 and 100)` to match the plan and the API validation.

</details>

<details>
<summary>Details</summary>

### `pending_qty` can go negative

The summary route accumulates `contributed_qty` and `returned_qty` independently, then sets `pending_qty = contributed_qty - returned_qty` at each step. At the end of the loop, the per-item `pending_qty` is the raw arithmetic difference with no floor. If an admin accidentally records more returns than contributions for a given item (data entry error), the API returns a negative `pending_qty`. The component renders this as a red number with the label format `ค้างอยู่ -5 ชิ้น`, which is nonsensical to the user.

```
// api/index.ts — the relevant assignment:
existing.pending_qty = existing.contributed_qty - existing.returned_qty;
```

The fix is a one-line clamp. The same applies to `total_pending` at the contributor level, which is derived from the item-level sums and would also go negative.

### Missing `returned_at` index

The migration as shipped:

```sql
create index if not exists contributor_returns_contributor_idx on public.contributor_returns(contributor);
create index if not exists contributor_returns_item_idx on public.contributor_returns(item_id);
```

The plan specified a third index: `contributor_returns_returned_at_idx on public.contributor_returns(returned_at desc)`. The GET query always orders by `returned_at DESC`, so every read does a sequential scan without this index. At small table sizes this is invisible, but it should be added before the table sees real traffic.

### SQL migration vs. plan divergence

The plan's `quantity` column was implemented as `qty` throughout (DB, API, types). This is an intentional divergence that is internally consistent. The `contributor` check constraint was weakened from `between 1 and 100` to `> 0`, which leaves no DB-level upper bound on the column. The API enforces the 100-char limit, but the DB should enforce its own invariants independently.

### Type contract between component and API

`ContributorReturn` in `frontend/src/types/index.ts` declares `qty: number`. The API GET returns `qty`. The component column definition uses `dataIndex: 'qty'`. The POST client function sends `{ qty }`. All of these are consistent. The only gotcha is the `InputNumber` in the form: `Form.useForm<ReturnFormValues>()` with `ReturnFormValues.qty: number` will receive `number | null` from `InputNumber` when empty, but `rules: [{ required: true }]` prevents a `null` from passing `onFinish`, so the submit path is safe.

### App.tsx integration

`'contributor-returns'` is present in:
- `MainView` union type — confirmed
- `ADMIN_VIEWS` array — confirmed
- `NAV_ITEMS` array with `GiftOutlined` icon — confirmed
- render block with `isAdmin &&` guard — confirmed

`GiftOutlined` is imported in the `@ant-design/icons` block. The component import is present at the top of the file. The render block is the last view in the `Content` section, before `</Content>`. No ordering or guard issues.

### POST validation completeness

The POST handler validates:
- `contributor`: non-empty string, ≤100 chars ✓
- `item_id`: non-empty string, existence check against `items` table ✓
- `qty`: `Number.isSafeInteger` and `> 0` ✓
- `note`: trimmed, sliced to 500 chars ✓

There is no check that `qty` does not exceed an integer safe upper bound beyond `Number.isSafeInteger`, which is `2^53 - 1`. The DB column is `integer` (32-bit), so values above `2147483647` will cause a DB error rather than a clean 400. This is an edge case and consistent with how other routes handle it (`stock_purchases` POST does not cap quantity either).

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `supabase/migrations/20261010_03_contributor_returns.sql` | New table `contributor_returns` with `id`, `contributor`, `item_id`, `qty`, `note`, `returned_at`; two indexes on `contributor` and `item_id` |
| `api/index.ts` | Added `GET /api/contributor-summary` (aggregates purchases + returns per contributor/item) and `GET`/`POST` `api/contributor-returns` (log read and insert) |
| `frontend/src/types/index.ts` | Added `ContributorReturn`, `ContributorSummaryItem`, `ContributorSummary` interfaces |
| `frontend/src/api/client.ts` | Added `fetchContributorSummary`, `fetchContributorReturns`, `createContributorReturn` |
| `frontend/src/components/Organization/ContributorReturns.tsx` | New two-tab component: summary cards with avatar + item breakdown, return form with pending chips, history table |
| `frontend/src/App.tsx` | Added `GiftOutlined` import, `ContributorReturns` component import, `'contributor-returns'` to `MainView`, `ADMIN_VIEWS`, `NAV_ITEMS`, and render block |

Full diff: `git diff main -- supabase/migrations/20261010_03_contributor_returns.sql api/index.ts frontend/src/components/Organization/ContributorReturns.tsx frontend/src/App.tsx`

</details>

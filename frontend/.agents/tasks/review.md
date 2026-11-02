# Withdrawal stock quantity display + /store page

Two tasks in two commits (`7841c94b`, `dd514e1c`). The withdrawal item Select in the non-admin user form now shows available quantity inline. A new `/store` route delivers a self-contained PIN-gated stock-tracking page with a fixed navbar, three tabs, and all state living in localStorage. Both changes are complete and correct against spec.

**Watch for:** The `/store` page seeds `localStock` from the live API on first mount — if the API is down at open time, all stock counts start at 0 and the user has no feedback (confirmed). The `isStore` path check is a one-time `useState` snapshot; direct navigation to `/store` works, but a client-side `pushState` to `/store` after load would not route to `StorePage` without a page reload (confirmed, likely by design for this app's architecture).

**Verdict**: APPROVED

---

## High-level view

The user-form Select now delegates its option rendering to `stockItemVisual`, which wraps every option in a flex row with the item image on the left and a right-aligned quantity badge — red `หมด` at 0, grey `เบิกได้ N ชิ้น` otherwise. The same `labelRender` keeps the display consistent after selection. The admin catalog Select is untouched.

The `/store` route is gated by a `useState` snapshot of `window.location.pathname` taken once on App mount. When the path is `/store`, `App.tsx` returns `<StorePage />` before any sidebar or main-nav renders, so the main app layout is never involved. The PIN gate checks localStorage key `store-pin-verified` before mounting anything else. Stock seeding runs once via a ref guard (`stockInitialised`) so re-fetches can't clobber local adjustments — this was added in the follow-up commit `dd514e1c`, which fixed a bug in the original.

All three tabs are present. Tab 1 (ภาพรวม) renders summary cards and a product grid with a sell modal that deducts from `localStock` only. Tab 2 (เติมสต็อก) has the form and history list, backed by localStorage key `store-restocks`. Tab 3 (บันทึกการขาย) is an Ant Design Table with per-row delete, backed by `store-sales`. No API writes are made from any store action.

<details>
<summary>Issues (2)</summary>

1. **Silent zero stock on API failure** — If `fetchAllData()` rejects on mount, `localStock` stays `{}` and every product shows `หมด`. There is no error state or user-visible message. Add a fallback alert or empty-state message so the user knows why everything reads as out-of-stock.

2. **`isStore` does not respond to client-side navigation** — The store path check is a one-time `useState` snapshot. If the app ever pushes `/store` via `history.pushState` or a router link without a full page reload, `StorePage` will not render. Currently harmless because no router link points to `/store`, but worth noting if a link is added later.

</details>

<details>
<summary>Details</summary>

### Withdrawal Select: inline stock badge

`stockItemVisual` at line 411 builds a `<span className="withdrawal-stock-option">` that wraps `<ItemLabel>` and a count badge. The badge class `withdrawal-stock-option__count` styles it grey at `#64748b`; the modifier `.is-empty` switches it to `#dc2626` (red). Both `optionRender` and `labelRender` on the user-form Select call this function, so the quantity is visible in the dropdown list and in the field after selection. The `options` array already carries `available: availability[id] ?? 0` and sets `disabled` when availability is 0, so the visual and the disabled state are consistent.

The admin catalog Select at line 455 uses `withdrawalItemVisuals` unchanged — no regression.

### Silent zero stock on API failure

`fetchAllData` is called once when `verified` becomes true. On rejection, the catch block is `() => { /* silent */ }`. `localStock` stays `{}`, every product card shows `หมด` in red, and the restock dropdown is empty because it reads from `apiData?.itemNames ?? {}`. There is no error banner or retry prompt in the store page at all, so a transient network error at open time leaves the page looking like empty stock with no path to recovery.

</details>

---

## File map

<details>
<summary>Changed files</summary>

- `frontend/src/components/Withdrawals/Withdrawals.tsx` — added `stockItemVisual` helper and wired it to `optionRender`/`labelRender` on the user-form item Select
- `frontend/src/components/Store/StorePage.tsx` — new file; PIN gate, 3-tab layout, sell modal, restock form, sales table, all localStorage-backed
- `frontend/src/App.tsx` — added `isStore` path check and early return to `StorePage`
- `frontend/src/index.css` — added `.withdrawal-stock-option*` and `.store-*` class rules

</details>

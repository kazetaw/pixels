# Review: CharacterTracker UX Fixes — commit 226bdd70

## Scope
Commit `226bdd70` modifies two files: `CharacterTracker.tsx` (+207/−118) and `CharacterTracker.css` (+169/−107).

---

## Fix 1 — Auto-fill end time from recipe `time_per_unit`

**Location:** `calcEndTime` (line 88–96) + `SlotModal` onChange handler (lines 199–206)

- `calcEndTime` splits on `:`, maps to `Number`, destructures with defaults `[h=0,m=0,s=0]`, converts to ms, adds to `Date.now()`, formats as `HH:MM`. Parsing is correct for all valid `HH:MM:SS` strings; NaN-safe via default-to-0 destructure.
- `time_per_unit` is typed `string | null` in `frontend/src/types/index.ts`. The call site guards with `if (r.time_per_unit)` before passing to `calcEndTime`, so null is excluded. ✅
- The field is set only when a recipe is *selected*; clearing the recipe (`!val`) does not reset the time — this matches the requirement ("ไม่บังคับ / optional"), intentional per spec. ✅
- `setEndTime` is in scope via `useState` in `SlotModal`. ✅

## Fix 2 — AccountCard with 3-character tab selector

**Location:** `AccountCard` function (lines 364–558)

- `CharacterCard` component and its `CharacterCardProps` interface are fully removed; the separate `ct-grid` CSS is removed.
- Each `AccountId.chars` array (always 3 entries, enforced by `AddIdModal`) maps to a `<button role="tab">` with `aria-selected`.
- `occFilter` dims non-matching tabs via `is-filtered` class (opacity 0.35, pointer-events none). ✅
- `useEffect` for auto-switching the active tab when occFilter changes: dep array is `[occFilter, account.chars, activeCharIdx]`. When all three chars are filtered out, `findIndex` returns `-1` and `setActiveCharIdx` is not called — `activeChar` would then be `account.chars[activeCharIdx]`, which is defined because all three chars remain in the array; they are only visually dimmed, never removed. No out-of-bounds risk. ✅
- The effect does not loop: it only calls `setActiveCharIdx` when the current index is filtered out, and then sets it to a *visible* index; on the next render the condition is false and no state update fires. ✅
- Avatar upload per character: `fileInputRefs` is `useRef<Array<HTMLInputElement|null>>([null,null,null])`. `handleAvatarClick` sets `cropTargetId` before triggering the ref, and `handleCropConfirm` reads `cropTargetId` to call the correct `onUpdateAvatar`. ✅
- LocalStorage persistence (`handleUpdateAvatar`) is unchanged; it maps by `charId` across all accounts. ✅
- `visibleChars` derivation and the `ct-grid` wrapper in the parent `CharacterTracker` are removed; the parent now renders a single `<AccountCard>` unconditionally when a selected account exists. The "ไม่มีตัวละครในอาชีพนี้" empty state path was removed — appropriate because tabs are always present but dimmed, so a full empty state is no longer needed. ✅

## Fix 3 — Hover-only clear slot button

**Location:** `handleClearSlot` (lines 414–417) + JSX clear button (lines 505–519)

- Button only renders when `hasContent = slot.status !== 'idle' || slot.itemKey !== ''`. ✅
- `onClick` calls `handleClearSlot(e, i)` which does `e.stopPropagation()` before `onUpdateSlot(…, {…, status: 'idle', endTime: ''})`. This prevents the parent `ct-slot` div's `onClick` from firing and opening `SlotModal`. ✅
- `onKeyDown` handles `Enter`/`Space` and also calls `handleClearSlot`, which calls `e.stopPropagation()`. ✅
- The button's CSS is `position: absolute; opacity: 0; transition: opacity 0.12s` with `.ct-slot:hover .ct-slot__clear { opacity: 1 }`. `.ct-slot` has `position: relative` — absolute positioning resolves correctly. ✅
- `focus-visible` rule sets `opacity: 1` and a blue outline — keyboard accessible. ✅
- `reduced-motion` rule adds `ct-slot__clear` to the `transition: none !important` block. ✅

## CSS Class Audit

| Requirement | Status |
|---|---|
| `.ct-modal-picker` removed | ✅ not present in CSS or TSX |
| `.ct-pick-tile` removed | ✅ not present in CSS or TSX |
| `.ct-grid` removed | ✅ removed from CSS; not used in TSX |
| `.ct-account-card` added | ✅ |
| `.ct-char-tabs` added | ✅ |
| `.ct-char-tab` added | ✅ |
| `.ct-char-tab__avatar` added | ✅ |
| `.ct-char-tab__name` added | ✅ |
| `.ct-slot__clear` added | ✅ |

Note: `.ct-card`, `.ct-card__header`, `.ct-avatar`, `.ct-name`, `.ct-occ-badge`, `.ct-dot` remain in the CSS. These rules are now unused by CharacterTracker (the old `CharacterCard` is gone), but they are pre-existing dead CSS, not introduced by this commit, and are out of scope per review charter.

## TypeScript Strict-Mode Check

- No `any` casts in the diff.
- `calcEndTime(timePerUnit: string): string` — explicit types, no implicit any.
- `fileInputRefs` typed as `useRef<Array<HTMLInputElement | null>>`.
- `cropTargetId` typed as `string | null`.
- `Recipe.time_per_unit` is `string | null`; guarded before use.
- Commit message records `tsc --noEmit: exit 0`. ✅

## Regression Check

| Feature | Evidence |
|---|---|
| Avatar upload + crop | `handleFileChange` → `setCropSrc` → `CropModal` path is intact; `handleCropConfirm` reads `cropTargetId` |
| localStorage persistence | `useEffect([accounts])` writing `LS_KEY` unchanged; `loadAccounts()` unchanged |
| Occ filter chip | `ct-occ-row` / `ct-occ-btn` unchanged; filter passed to `AccountCard` as prop |
| Add ID modal | `AddIdModal` component, `handleAddId`, `ct-chip--add` button all unchanged |
| SlotModal | `SlotModal` component unchanged except Fix 1 addition; called from `AccountCard` with correct `activeChar` |

## Findings

No blockers found.

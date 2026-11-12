# CharacterTracker — Code Review

**Commit:** `e658bcce` — feat: Add CharacterTracker pixel RPG avatar slot tracker  
**Reviewer pass:** 1

---

## 1. TypeScript (`tsc --noEmit`)

Commit message records: **`tsc --noEmit exit code: 0`**  
✅ Passes criterion.

---

## 2. Correctness — runtime safety

### 2a. Unhandled null/undefined

| Location | Assessment |
|---|---|
| `loadAccounts()` (CharacterTracker.tsx:65–70) | Wrapped in `try/catch`, returns `[]` on parse failure. ✅ |
| `px()` in pixelIcons.ts:9 | `grid[0]?.length ?? 0` guards empty grid. ✅ |
| `guessIcon()` fallback (CharacterTracker.tsx:95–103) | `icons[idx]` — `idx = key.charCodeAt(0) % icons.length`. If `key` is empty string, `key.charCodeAt(0)` returns `NaN`; `NaN % 8` is `NaN`; `icons[NaN]` is `undefined`. This can reach `svgToDataUrl(undefined)` → `encodeURIComponent(undefined)` → produces `"undefined"` string rather than a valid SVG. Visually produces a broken pixel icon in the slot modal for items with an empty key — not a crash but a data integrity issue. **LOW** — only triggered if `r.id` and `r.name` are both empty strings, which should be impossible for valid recipes. |
| `character.slots[slotModal]` (CharacterTracker.tsx:357) | `slotModal !== null` guard wraps the render, and characters are always initialised with 6 slots by `emptyChar`. ✅ |
| `cropSrc` passed to `URL.revokeObjectURL` (CharacterTracker.tsx:367) | Called as `URL.revokeObjectURL(cropSrc ?? '')` — the empty-string fallback is harmless. ✅ |

### 2b. Missing `key` props on lists

| Location | Assessment |
|---|---|
| `recipes.map(r => ...)` in `SlotModal` (CharacterTracker.tsx:189) | `key={r.id}` ✅ |
| `visibleChars.map(char => ...)` (CharacterTracker.tsx:400) | `key={char.id}` with wrapper `div key={char.id}` ✅ |
| `accounts.map(acc => ...)` ID chips (CharacterTracker.tsx:385) | `key={acc.id}` ✅ |
| `OCCUPATIONS` filter buttons (CharacterTracker.tsx:396) | `key={occ}` ✅ |
| `chars.map((c, i) => ...)` in `AddIdModal` (CharacterTracker.tsx:285) | `key={i}` — index key on a fixed-length, non-reordered array; acceptable here. ✅ |
| `character.slots.map((slot, i) => ...)` (CharacterTracker.tsx:324) | `key={i}` — fixed-length slots array, not reordered; acceptable. ✅ |

### 2c. Malformed SVG strings in pixelIcons.ts

All pixel-art builders follow the same `px(grid, palette)` path. Spot-checks:

- **`makeEngineer()`**: 16 rows × 16 chars each — uniform. `palette` keys used (`H`,`F`,`S`,`b`,`w`,`e`) all defined. ✅  
- **`makeMedicine()`** (8×8 icon): row 0 is `'..bbbbb.'` (8 chars), row 6 is `'..bbbb..'` (8 chars). All rows 8 chars wide. Palette keys (`r`,`w`,`b`) all defined. ✅  
- **`makePotion()`**: all rows 8 chars wide. Palette keys (`p`,`b`,`w`,`l`) all defined. ✅  
- Remaining builders follow the same pattern; no structural defect found.

Output is valid inline SVG (namespace declared, `shape-rendering="crispEdges"`, `viewBox` correct). `svgToDataUrl()` uses `btoa(unescape(encodeURIComponent(svg)))` — correct UTF-8-safe base64 encoding. ✅

---

## 3. Wiring in App.tsx

| Check | Evidence | Result |
|---|---|---|
| `'character-tracker'` in `MainView` union type | Line: `type MainView = '...' \| 'character-tracker'` | ✅ |
| `'character-tracker'` in `ADMIN_VIEWS` | `const ADMIN_VIEWS: MainView[] = [..., 'character-tracker']` | ✅ |
| `'character-tracker'` in `NAV_ITEMS` | `{ key: 'character-tracker', icon: <TeamOutlined />, label: 'ติดตามตัวละคร' }` | ✅ |
| Render block | `{isAdmin && view === 'character-tracker' && <div className="page-content"><CharacterTracker ... /></div>}` | ✅ |
| Import | `import { CharacterTracker } from './components/CharacterTracker/CharacterTracker';` | ✅ |

All four wiring requirements met.

---

## 4. LocalStorage — `ct-accounts`

**Read** (`loadAccounts`, CharacterTracker.tsx:65–70):
```ts
try {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as AccountId[];
} catch {
  return [];
}
```
JSON parse errors caught, returns `[]`. ✅

**Write** (`useEffect`, CharacterTracker.tsx:285–289):
```ts
try {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts));
} catch { /* quota exceeded, silent */ }
```
QuotaExceededError caught silently. ✅

Both read and write are guarded. No blocking issue.

---

## 5. CropModal usage

**Import path** (CharacterTracker.tsx:5):  
`import { CropModal } from '../shared/CropModal';`  
File confirmed at `src/components/shared/CropModal.tsx`. ✅

**Props passed** (CharacterTracker.tsx:360–364):
```tsx
<CropModal
  open={!!cropSrc}
  src={cropSrc}
  aspect={1}
  outputSize={200}
  onConfirm={handleCropConfirm}
  onCancel={() => { URL.revokeObjectURL(cropSrc ?? ''); setCropSrc(undefined); }}
/>
```

CropModal's `Props` interface:
```ts
interface Props {
  open: boolean;         // ✅ !!cropSrc
  src: string | undefined; // ✅ cropSrc (string | undefined)
  title?: string;        // optional, omitted — fine
  aspect?: number;       // ✅ 1
  outputSize?: number;   // ✅ 200
  onConfirm: (blob: Blob) => void; // ✅ handleCropConfirm
  onCancel: () => void;  // ✅ inline arrow
}
```
All required props present, types match. ✅

---

## Summary

No blocking findings. One LOW-severity observation (empty-key guard in `guessIcon`) does not affect any reachable path in production because `r.id` is always non-empty for valid `Recipe` objects.

# CharacterTracker Rewrite — Review

Commit: `dd4d7bba` — "CharacterTracker: floor-style rows with live countdown timers"  
Files reviewed: `CharacterTracker.tsx`, `CharacterTracker.css`

---

## Evidence Summary

### Build / Type-check
Commit body records: `tsc --noEmit: exit 0, no errors`. Requirement 12 ✓

### Spec checks (item by item)

| # | Requirement | Evidence | Result |
|---|-------------|----------|--------|
| 1 | `Slot` has `startTime: string \| null`, `durationSeconds: number` | Lines 16–21 of .tsx | ✓ |
| 2 | `emptySlot()` returns `startTime: null, durationSeconds: 0` | Line 55 | ✓ |
| 3 | `loadAccounts()` migrates old LS data via `patchSlot` | Lines 64–80 — `patchSlot` fills `startTime ?? null` and `durationSeconds ?? 0` for every slot | ✓ |
| 4 | Flat list of CharacterRow cards, one per character, all accounts | `filteredRows` flatMaps all accounts; renders `<CharacterRow>` per entry | ✓ |
| 5 | Each row: avatar 32px (click→CropModal), name, occ badge, account label badge, inline-edit pencil | Present in `CharacterRow` JSX and `.ct-avatar { width:32px; height:32px }` | ✓ |
| 6 | `ct-row-slots` grid: `repeat(6,1fr)` | CSS line 190 | ✓ |
| 7 | Slot: status strip, slot number, item image 40px, item name ≤2 lines, timer, action button | All present in slot render block | ✓ |
| 8 | Status transitions: idle+recipe→▶เริ่ม sets startTime+run; run→⏹หยุด→done; done/over→รีเซ็ต→idle,startTime=null; hover ✕ clears | Present in action button logic | ✓ |
| 9 | Auto-transition run→over in `useEffect` on `[now]` in CharacterRow | Lines ~315–322 | ✓ |
| 10 | `setInterval(1000)` in CharacterTracker ticks `now` | Lines ~406–410 | ✓ |
| 11 | SlotModal has no status Select; recipe selection auto-fills `durationSeconds` | SlotModal component: no status Select present; `onChange` on recipe calls `parseTimeSeconds` and `setDurationSeconds` | ✓ |
| 12 | `tsc --noEmit` exited 0 | Commit body | ✓ |
| 13 | CSS classes present; breakpoint at 640px → 3 cols; ct-flash; prefers-reduced-motion | All classes confirmed. `ct-flash` keyframe at CSS line 287. `prefers-reduced-motion` disables flash at line 292. **Breakpoint: `max-width: 639px`** — see finding below | ⚠ |
| 14 | Commit message exact match; push to main | HEAD = `dd4d7bba`, branch = `main`, `origin/main` | ✓ |

---

## Findings

### FINDING 1 — Non-blocking: idle timer text is `--:--:--` not `--:--`

**Location:** `CharacterTracker.tsx` line 501  
**Spec (req 7):** timer shows `--:--` for idle slots with a recipe but not yet started.  
**Code:** returns `'--:--:--'` (8 chars, six-digit HH:MM:SS form).

The `--:--:--` string is internally consistent with the `clock()` HH:MM:SS format used by the running timer, so it communicates the same meaning correctly. It is a minor deviation from the literal spec string but causes no correctness, security, or data failure. Classed non-blocking.

### FINDING 2 — Non-blocking: responsive breakpoint is `max-width: 639px`, spec says `640px`

**Location:** `CharacterTracker.css` line 380  
**Spec (req 13):** "responsive breakpoint at 640px sets 3 columns"  
**Code:** `@media (max-width: 639px)` (triggers below 640px, so 640px itself still shows 6 columns)

The practical difference is exactly one pixel-wide viewport. The intent of the breakpoint — that mobile-width viewports show 3 columns — is fully preserved. No layout failure, no functional difference at any real device width. Classed non-blocking.

---

## Verdict

**APPROVED.** No blocking correctness, security, or data failures. Both findings are minor literal deviations from the spec text with no functional consequence. All 14 spec requirements are substantively satisfied, build exits clean (tsc exit 0, commit recorded), and the commit is on `main`.

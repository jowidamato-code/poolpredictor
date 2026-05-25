## Goal

Store the official FIFA 2026 third-place allocation table as a static TypeScript lookup. **Data only — no UI, no logic wiring in this step.**

## File to create

`src/lib/third-place-allocation.ts`

```ts
export type Best3Slot = "M74" | "M77" | "M79" | "M80" | "M81" | "M82" | "M85" | "M88";

// Key: 8 qualifying 3rd-place group letters, sorted A→L (e.g. "ABCDEFGH").
// Value: which group's 3rd-place team fills each Best-3rd R32 slot.
// Source: FIFA 2026 official third-place allocation table (495 combinations).
export const THIRD_PLACE_ALLOCATION: Record<string, Record<Best3Slot, string>> = {
  "ABCDEFGH": { M79: "...", M85: "...", M81: "...", M74: "...", M82: "...", M77: "...", M88: "...", M80: "..." },
  // ...495 entries total
};
```

## Column → match mapping

Derived from the existing `R32_SLOTS` table in `src/lib/knockout-derivation.ts`:

```text
CSV column  →  R32 match
1A          →  M79   (idx 5)
1B          →  M85   (idx 11)
1D          →  M81   (idx 7)
1E          →  M74   (idx 0)
1G          →  M82   (idx 8)
1I          →  M77   (idx 3)
1K          →  M88   (idx 14)
1L          →  M80   (idx 6)
```

## Generation process

1. Write the 495-row CSV to `/tmp/gen/data.csv` (in chunks to avoid command-size limits).
2. Run a Node script that:
   - Parses each row, strips the leading `3` from each cell (e.g. `3E` → `E`).
   - Pairs each cell with its column's match number.
   - Sorts the 8 group letters alphabetically to form the key.
   - Emits the TS file.
3. Validate before writing the final file:
   - Exactly 495 rows parsed.
   - Every row produces 8 distinct letters → 8-char unique sorted key.
   - No duplicate keys across the 495 rows.
   - Every value has all 8 `M##` slots filled.
4. If any assertion fails, stop and report — do not write a half-correct file.

## Out of scope

- Wiring the lookup into `deriveKnockoutTeams` / replacing `assignBest3rdSlots` (next step).
- Any UI, migration, or DB changes.
## Scope (visual only — no scoring/data logic changes)

Three cosmetic tweaks to the knockout displays in **My Picks** and **Predictions** tabs. No DB writes, no derivation/scoring changes.

---

### 1. Re-order Knockout matches into half-bracket order

Today, knockout matches are listed by `match_number` ascending. I'll sort them top half of the bracket first (everything feeding SF M101), then bottom half (everything feeding SF M102).

Applied via a shared helper `sortKnockoutByBracket(matches)` in `src/lib/tournament-utils.ts`, used by:
- `src/components/tournament/KnockoutBracketView.tsx` (Predictions → KO rounds)
- `src/components/tournament/MyPredictionsTab.tsx` (My Picks → KO rounds)

**Order (top → bottom):**

```text
Round of 32:
  M74, M77, M73, M75, M83, M84, M81, M82,
  M76, M78, M79, M80, M86, M88, M85, M87

Round of 16:    M89, M90, M93, M94, M91, M92, M95, M96
Quarter-finals: M97, M98, M99, M100
Semi-finals:    M101, M102
Third Place:    M103
Final:          M104
```

Trace: top half → SF M101 (QF M97 = R16 M89+M90, QF M98 = R16 M93+M94); bottom half → SF M102 (QF M99 = R16 M91+M92, QF M100 = R16 M95+M96).

---

### 2. R32-only: show source-group label

Under each R32 match card, add a small muted label derived from `R32_SLOTS` (already in `knockout-derivation.ts`). Format:

- Winner slot → `1<group>` (e.g. `1F`)
- Runner-up slot → `2<group>` (e.g. `2C`)
- Best-3rd slot → `Best 3rd`

Examples:
```text
M73 — 2A vs 2B
M74 — 1E vs Best 3rd
M75 — 1F vs 2C
M76 — 1C vs 2F
M77 — 1I vs Best 3rd
```

Applies to both **My Picks → Round of 32** and **Predictions → Round of 32**. Other rounds unchanged.

---

### 3. My Picks → KO rounds: show kickoff time

Today My Picks KO cards show only `#<match_number>`. I'll add the same Malta date/time line the Predictions KO view already shows:

```text
29/06 · 19:00 MLT
```

using `formatMaltaDate(match.match_date)` + `formatMaltaTime(match.match_date)`. Group-stage rendering untouched.

---

### Technical details

- New helper `BRACKET_ORDER_BY_ROUND` (const) + `sortKnockoutByBracket(matches)` in `src/lib/tournament-utils.ts`. Pure function.
- New helper `r32GroupLabel(matchNumber) → { a: string; b: string }` derived from `R32_SLOTS` (index = `matchNumber - 73`). Exported from `src/lib/knockout-derivation.ts`.
- `KnockoutBracketView.tsx`: wrap `matches.filter(m => m.round === round)` with `sortKnockoutByBracket(...)`. For R32 only, add a `<span className="text-[10px] text-muted-foreground">{a} vs {b}</span>` inside the existing meta row.
- `MyPredictionsTab.tsx`: same sort wrap; for KO rounds add a Malta date/time line next to `#<match_number>`; for R32 add the group-label sub-line.
- No changes to: derivation logic, scoring, DB schema, predictions read/write, admin views, group stage views.

### Validation

- Inspect Predictions → R32 and My Picks → R32: card order matches the list above; group labels render correctly.
- Confirm R16 order is M89, M90, M93, M94, M91, M92, M95, M96 (no longer sequential).
- Confirm group stage rendering is untouched.

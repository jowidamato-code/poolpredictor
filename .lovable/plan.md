## Problem

In `scoreDerivedProgression` (`src/lib/scoring.ts`), the "actual teams that reached round R" set is built from the `team_a_id` / `team_b_id` fields on matches of round R:

```ts
for (const m of matches) {
  if (m.round && actualReached[m.round]) {
    if (m.team_a_id) actualReached[m.round].add(m.team_a_id);
    if (m.team_b_id) actualReached[m.round].add(m.team_b_id);
  }
}
```

This only counts a team as having "reached" R16 once the admin has slotted it into an R16 match. Right now R32 is finished but not every R16 matchup has been entered, so teams that demonstrably advanced (Canada, Morocco, Brazil, …) aren't yet in any R16 `team_a_id`/`team_b_id` slot → users lose 4 points per missing team.

This matches the reports:
- Alex (Canada + Morocco + Brazil): 2 of 3 currently slotted into R16 → 8 pts instead of 12.
- Jade (Canada + Brazil): 1 of 2 slotted → 4 pts instead of 8.

## Fix

Derive "actual teams that reached round R" from the **winners of the previous round's played matches**, not from slot assignments of round R. This matches the rule we already agreed on: progression is tournament-level, independent of the specific matchup.

Mapping:
- `round_of_16` ← winners of played `round_of_32` matches
- `quarter_final` ← winners of played `round_of_16` matches
- `semi_final` ← winners of played `quarter_final` matches
- `final` ← winners of played `semi_final` matches
- champion ← `winner_id` of played `final` (unchanged)

Where a round R match has a played result but no `winner_id` set (shouldn't happen post-fix, but defensive), fall back to the higher-scoring side.

No other behaviour changes. Predicted-side derivation, group-stage scoring, match-level scoring, and bonus scoring stay as-is.

## Files

- `src/lib/scoring.ts` — rewrite the `actualReached` construction inside `scoreDerivedProgression`.

## Verification

- Spot-check Alex Cini and Jade against the live DB after the change: their R16 progression should be 12 and 8 respectively.
- Confirm no regression for users whose predicted R16 teams *are* already slotted in (their totals shouldn't change).
- Confirm QF/SF/Final/champion logic continues to award only when the corresponding prior-round matches are played.

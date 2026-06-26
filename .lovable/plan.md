## What's wrong

`deriveKnockoutTeams` in `src/lib/knockout-derivation.ts` chains rounds sequentially: R32 winner i feeds R16 match `floor(i/2)`, R16 winner i feeds QF `floor(i/2)`, etc. The official FIFA 2026 bracket is **not** sequential past R32 — it skips around so geographic groupings stay balanced. Two rounds are wrong:

**Round of 16 (per your list):**

```text
M89 = W74 v W77      M93 = W83 v W84
M90 = W73 v W75      M94 = W81 v W82
M91 = W76 v W78      M95 = W86 v W88
M92 = W79 v W80      M96 = W85 v W87
```

**Quarter Finals:**

```text
M97  = W89 v W90     M99  = W91 v W92
M98  = W93 v W94     M100 = W95 v W96
```

(SF M101=W97 v W98, M102=W99 v W100, 3rd M103, Final M104 — these are already sequential and correct.)

Same class of bug as the R32 fix, with the same downstream blast radius: any user who already has R16/QF/SF/Final picks set has them stored against the wrong derived teams.

## Fix

### 1. Code: explicit bracket maps (no more sequential chaining)

In `src/lib/knockout-derivation.ts`, replace the chained `winners[i*2]/[i*2+1]` block with explicit per-round source maps keyed by match_number:

```ts
const R16_SOURCES: Record<number, [number, number]> = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
};
const QF_SOURCES: Record<number, [number, number]> = {
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
};
const SF_SOURCES: Record<number, [number, number]> = {
  101: [97, 98], 102: [99, 100],
};
const FINAL_SOURCES: Record<number, [number, number]>  = { 104: [101, 102] };
const THIRD_SOURCES: Record<number, [number, number]>  = { 103: [101, 102] }; // losers
```

Resolve each match by looking up its sources by `match_number`, then reading the predicted winner of those source matches. Third-place keeps its existing "loser of" logic but uses `THIRD_SOURCES` instead of indexing semis 0/1.

R32 itself is unaffected — `R32_SLOTS` (group winners/runners/best-3rd) is already correct from the last fix.

### 2. Data backfill: rescue stored picks for R16 → Final

Same approach as the R32 remap script you already approved. New one-off script `scripts/remap-r16-bracket.ts`:

- For every user, compute **old** vs **new** `(team_a_id, team_b_id)` for each match in R16/QF/SF/Final using their own predictions.
  - "Old" = the previous sequential chaining.
  - "New" = the explicit FIFA maps above.
- For each affected prediction, remap by slot position:
  - `predicted_team_through == old.team_a_id` → `new.team_a_id`
  - `predicted_team_through == old.team_b_id` → `new.team_b_id`
  - otherwise → clear (user gets the existing "please repick" warning)
- Same rule for `predicted_winner_id` so scoring stays consistent.
- Propagate downward: rebuild each user's R16 winners under the new bracket before computing QF old/new pairs, and so on through SF and Final. Third place uses losers of the user's new SF predictions.
- **Dry run first** — print a per-user, per-match diff (old pair → new pair, old pick → new pick or "cleared"). You approve, then I re-run with `--apply` using the service role.

### 3. No schema change, no app behaviour change beyond the fix

- No migration.
- No UI changes — `MyPredictionsTab`, `KnockoutBracketView`, admin tabs all read from `deriveKnockoutTeams`, so they pick up the corrected pairings automatically.
- Existing "previous pick is no longer in this matchup" warning catches anything the remap can't resolve cleanly.

## Safety

- Predictions are locked, so no race with users editing while we backfill.
- Group stage, scores, and any pick that's still valid under the new bracket are untouched.
- Dry-run diff before any write; you sign off first.

## Deliverables back to you

1. Dry-run report: affected user count + per-match old→new remap and any cleared rows.
2. After apply: confirmation counts and a spot-check on one user from each affected match (M89, M90, M91, M98, M99) to verify their team_through now matches the new derived pair.
3. Quick count of how many users predicted a draw in any R16/QF/SF/Final match (so we know how many manual "team to advance" picks needed remapping vs were just regular winners).

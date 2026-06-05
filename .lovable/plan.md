## Goal

1. **Admin side** — extend Group Results so admins can manually pin all 4 finishing positions per group (not just winner / runner-up). This feeds the existing knockout auto-fill (R32 best-3rd ranking uses positions 3, knockout slotting uses 1 & 2).
2. **Participant side** — extend the personal standings tiebreaker chain to: points → GD → GF → **H2H pts → H2H GD → H2H GF → manual user pick**. The manual picker only surfaces for the rare case where teams are still level after H2H.

Both changes preserve current behavior whenever the new logic isn't needed, so existing in-progress predictions are untouched.

---

## 1. Admin — override all 4 positions

### Schema
Extend `public.group_results` with two nullable columns:
- `third_place_team_id uuid` (FK teams.id)
- `fourth_place_team_id uuid` (FK teams.id)

Existing rows keep working (both new columns NULL = auto-derive position 3/4 from match results, same as today).

### UI
`src/components/admin/GroupResultsTab.tsx`: replace the 2-select layout with a 4-row table (1st / 2nd / 3rd / 4th). Each row is a `Select` listing the 4 teams in the group, with duplicate-prevention (a team picked in one row is disabled in the others). "Reset to auto" clears the whole row set for that group.

### Downstream wiring
- `src/lib/admin-knockout-assignment.ts` already reads `group_results.winner_team_id` and `runner_up_team_id`; no change needed for R32 slots 1 & 2.
- Best-3rd ranking helper (`rankThirdPlace` in `knockout-derivation.ts`) currently picks each group's 3rd-place team from match results. Update it to prefer `group_results.third_place_team_id` when set, else fall back to auto-derivation. This is the only line that affects bracket auto-fill.

### Participant impact
None. Participants never read `group_results` — their bracket projections are computed from their *own* predictions. Admin overrides only drive admin-side actual-result knockout assignment and scoring.

---

## 2. Participant — H2H + manual tiebreaker

### Computation (pure helper, no DB)
Extend `computeGroupStandings` in `src/lib/tournament-utils.ts`:

1. Keep current sort (pts → GD → GF).
2. After sorting, walk the list and find runs of teams equal on all three. For each tied run of 2+ teams, re-sort that subset by H2H pts → H2H GD → H2H GF computed from only the matches *between* the tied teams (using `localPredictions`).
3. If a tied run is still unresolved after H2H, return it as an `unresolvedTie: { tieKey: string; teamIds: string[] }` alongside the standings. `tieKey` is the sorted team-id list joined with `|` so it's stable across re-renders and across users.
4. Apply any user-supplied manual order for that `tieKey` on top.

Return signature becomes `{ standings: GroupStanding[]; unresolvedTies: UnresolvedTie[] }`. All existing callers (`isGroupComplete`, knockout-derivation, StandingsTab, MyPredictionsTab) keep working by reading `.standings` — I'll add a tiny shim so call sites that don't care about ties don't need edits.

### Storage (per-user, minimal)
New table `public.prediction_group_tiebreakers`:
- `user_id uuid` (FK auth.users, on delete cascade)
- `group_name text`
- `tie_key text` (sorted team-id join)
- `ordered_team_ids uuid[]` (user's chosen order among the tied subset)
- PK `(user_id, group_name, tie_key)`
- RLS: user can CRUD their own rows; writes blocked once `predictions_unlocked()` is true (same deadline gate as predictions).
- Grants: `SELECT, INSERT, UPDATE, DELETE TO authenticated`; `ALL TO service_role`.

This is additive — absence of a row means "no manual override needed yet"; existing users have zero rows and see no change unless they actually produce a tied prediction.

### UI
`src/components/tournament/GroupStageView.tsx`: when `unresolvedTies.length > 0` and the group is complete, render a small "Tie to resolve" card under the standings table per tie, listing the tied teams with up/down reorder buttons (no drag-and-drop — keeps mobile clean). Saves on each reorder via debounced upsert, same pattern as match predictions. Locked state respected.

Knockout-derivation on the participant side already calls `computeGroupStandings`; once it returns the H2H-resolved + user-ordered standings, R32 slots and best-3rd ranking re-compute automatically. No changes to `knockout-derivation.ts` logic, only to its input (which is already the standings array).

### Tournament page wiring
`src/components/tournament/PredictionsTab.tsx` (and `MyPredictionsTab.tsx` if it also renders standings): load the user's tiebreaker rows alongside predictions, pass them down to `GroupStageView`, expose an `onTiebreakerChange` handler that upserts to the new table.

---

## Files touched

- **Migration** — add 2 columns to `group_results`; create `prediction_group_tiebreakers` with RLS + grants.
- **Edit** `src/components/admin/GroupResultsTab.tsx` — 4-position picker UI.
- **Edit** `src/lib/knockout-derivation.ts` — `rankThirdPlace` honors admin override for position 3.
- **Edit** `src/lib/tournament-utils.ts` — H2H tiebreaker, return `unresolvedTies`, back-compat shim.
- **Edit** `src/components/tournament/GroupStageView.tsx` — render tie-resolution card, accept user overrides.
- **Edit** `src/components/tournament/PredictionsTab.tsx` (+ `MyPredictionsTab.tsx` if needed) — load/save user tiebreaker rows.
- **No changes** to `predictions`, `matches`, scoring, or any RLS on existing tables.

## Open questions / confirmations

1. **Tie UI affordance** — up/down arrows per row OK, or do you want a "1st of tied / 2nd of tied / …" dropdown per team? Arrows are simpler on mobile; dropdowns make the order explicit.
2. **Admin position 3/4** — should picking position 3 manually also bypass H2H in the best-3rd cross-group ranking (i.e. the manually-picked team's pts/GD/GF still come from match results, but its rank within its group is fixed)? Default: yes, that's the whole point of the override.
3. **Deadline lock for participant tiebreakers** — locked at the same `prediction_deadline` as predictions. Confirm that's what you want (vs. a later "group stage end" lock).

Once you confirm, I'll implement in build mode.

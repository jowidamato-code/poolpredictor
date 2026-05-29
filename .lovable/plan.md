## Goal

Mirror the participant-side bracket logic (`src/lib/knockout-derivation.ts`) on the admin Match Results tab, so that as soon as group results are finalized the knockout bracket auto-populates with the *actual* qualifiers — using the same 495-combination FIFA lookup table for the 8 best 3rd-placed teams. Admins can override any slot, and can also pick the winner when a knockout match ends level.

## Scope

### 1. Auto-fill knockout slots from official group results

Trigger: any change to **Group Results** (winner/runner-up override) or to a played group-stage match result.

Behavior:
- **R32 group-winner slots** → auto-set from `group_results.winner_team_id` (falling back to the auto-derived top-1 if no override row exists).
- **R32 runner-up slots** → auto-set from `group_results.runner_up_team_id` (same fallback).
- **R32 best-3rd slots** → once all 12 third-placed teams are known, pick the qualifying 8 (pts → GD → GF; admin-resolvable ties — see §3) and slot them via the existing `THIRD_PLACE_ALLOCATION` 495-entry table.
- **R16 / QF / SF / Final / 3rd-place** → auto-fill once the feeder knockout match has a saved winner (see §2).

Implementation: a single pure helper `computeAdminKnockoutAssignments(teams, matches, groupResults, thirdPlaceTiebreakers)` lives in `src/lib/admin-knockout-assignment.ts`. It reuses the `R32_SLOTS` constant and `THIRD_PLACE_ALLOCATION` lookup already exported from `knockout-derivation.ts` (refactored out of that file so both sides import from the same source — no duplication). Returns a `Record<matchId, { team_a_id, team_b_id }>` of the *suggested* assignments.

Writes: when the admin opens the Match Results tab (or after saving a relevant result), the page diffs current DB `matches.team_a_id/team_b_id` against the computed suggestion and shows a small "Apply suggested teams" banner per round. Nothing is written silently — admin clicks once to commit, or edits inline first.

### 2. Manual override per slot + draw-winner selector

Each knockout match card gets:
- **Team A picker** and **Team B picker** (replacing the "TBD" labels). Defaults to the auto-suggested team; dropdown lists eligible teams for that slot first, then a "Show all 48 teams" toggle for true overrides.
  - For R32: eligible = the FIFA group/best-3rd pool for that slot.
  - For R16+: eligible = the two possible winners of the two feeder matches.
- **"Winner if drawn" picker** (only shown when `score_a === score_b` and both are non-null). Required before the match can be marked Played with equal scores. Stored in the existing `matches.winner_id` column (already nullable, already admin-RLS-writable).
  - When scores are unequal, `winner_id` is auto-computed on save (matches current behavior — see `handleUpdateMatchResult` in dashboard.tsx).
  - When the admin changes `winner_id` on a played knockout match, downstream slots re-compute and the banner re-appears.

### 3. Best-3rd cutoff ties

If the 12 third-placed teams contain a tie that straddles the 8/9 cutoff (e.g. four teams tied for slots 7-10), show a small "Resolve 3rd-place tiebreaker" card above the R32 results listing the tied teams and asking the admin to pick which `N` advance. Persisted via a new `settings` row `third_place_tiebreakers` (jsonb array of `{ tieKey, advancing: uuid[] }`, same shape `rankThirdPlace` already accepts).

### 4. Schema

None. All needed columns exist:
- `matches.team_a_id`, `team_b_id`, `winner_id` — already nullable, admin-RLS-writable.
- `group_results` — already in use.
- `settings` — extended with one new key for 3rd-place tiebreakers.

## Files touched

- **New** `src/lib/admin-knockout-assignment.ts` — pure helper, no DB.
- **Refactor** `src/lib/knockout-derivation.ts` — export `R32_SLOTS`, `BEST3_SLOTKEY_BY_MATCH`, `rankThirdPlace` so the admin helper reuses them. No behavior change for participants.
- **Edit** `src/routes/_authenticated/_admin/dashboard.tsx` — Match Results tab: add team pickers, draw-winner picker, "Apply suggested teams" banner, 3rd-place tiebreaker card. All writes go through the existing `supabase.from("matches").update(...)` path; no new server functions.
- **Edit** `src/components/admin/GroupResultsTab.tsx` — on save, no code change, but document that changes here propagate to the Match Results suggestions on next reload (already true via `loadData`).

## Out of scope

- Penalty shootouts as a separate UI (the "Winner if drawn" picker already covers the data need — we can add a "decided by penalties" flag later if you want it shown to participants).
- Bracket structure / fixture reordering.
- Changes to participant-side derivation behavior.
- Scoring rule changes.

## Open question

When the admin overrides a slot manually and *then* the upstream auto-suggestion would change (e.g. they hand-picked the R16 team, then a feeder R32 match result changes), should we (a) leave the override untouched and show a warning, or (b) overwrite back to the new suggestion? My default would be **(a) — manual overrides win, with a warning banner** so we never silently flip something the admin set. Confirm and I'll build it that way.

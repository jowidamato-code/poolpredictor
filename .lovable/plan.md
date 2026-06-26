# Fix stale "team to advance" picks after R32 reorder

## Counts you asked for (already pulled)
- **M73** — 4 users predicted a draw (all 4 have a "team to advance" pick set)
- **M88** — 15 users predicted a draw (all 15 have a "team to advance" pick set)

The remap below is for these 19 users plus any knock-on effect into Round of 16.

## The problem

The R32 reorder changed which derived teams populate matches M73…M88, but each user's stored `predicted_team_through` (team chosen to advance after a predicted draw) still references the team they originally clicked. Result: the UI shows the new derived pair (e.g. USA vs Egypt) but their "team to advance" is the old team (e.g. CAN), which is no longer in the matchup.

Same risk in R16: those matches derive `team_a`/`team_b` from R32 winners. If a user's R32 winner shifted, their R16 "team to advance" may now point at a team that isn't in the R16 matchup.

## Fix strategy (one-time data backfill)

For every user, per affected match, compute both the **old** and **new** derived `(team_a_id, team_b_id)` from their own group predictions, then remap by slot position:

- `predicted_team_through == old.team_a_id` → set to `new.team_a_id`
- `predicted_team_through == old.team_b_id` → set to `new.team_b_id`
- otherwise → clear it (unmappable; user will see the existing "please repick" warning)

Same rule applies to `predicted_winner_id` so scoring stays consistent.

Then propagate to R16:
- Build a per-user map `oldR32Winner[i] → newR32Winner[i]` (for predictions that had a clear winner, including the just-remapped draw picks)
- For each R16 prediction, remap `predicted_team_through` / `predicted_winner_id` via the same old→new lookup.

QF / SF / Final are not touched: they chain off R16, and R16 team_a/team_b will re-derive correctly from the patched R32 winners on next view. Their stored `team_through` only becomes stale if a user's specific chained winner changed; if any case remains, the existing in-app "please repick" warning will catch it.

## Implementation

1. **Add a one-off script** `scripts/remap-r32-team-through.ts` (run locally with `bun`, uses service role key from env):
   - Loads `teams`, `matches`, all `predictions`, `bonus_predictions` (for `group_tiebreakers`), `group_results` overrides.
   - Imports the current `deriveKnockoutTeams` from `src/lib/knockout-derivation.ts` for the NEW derivation.
   - Inlines a copy of the **previous** `R32_SLOTS` array (reconstructable from the prior shift: old idx0 = current idx1, …, old idx13 = current "RU-A vs RU-D", old idx14 = current "RU-B vs RU-G") for the OLD derivation. I will reconstruct it exactly from git history before running.
   - For each user: compute old vs new R32 team pairs and remap predictions as above. Then compute old vs new R32 winners and remap R16 predictions.
   - Prints a dry-run diff first (which users, which matches, old→new team_through).
2. **You review the dry-run output**, then I re-run with `--apply` to write the updates via the service role client.
3. **No schema change**, no migration. Only `UPDATE predictions SET predicted_team_through = …, predicted_winner_id = …` for affected rows.
4. **No code changes** in the app itself — the bracket logic is already correct since the last fix; this just rescues stored picks.

## Safety

- Dry-run first, you approve the diff before any write.
- Only touches rows where `predicted_team_through` is currently set AND is unmappable to the new pair via slot position.
- Leaves group-stage predictions, scores, and any already-valid picks untouched.
- Tournament is live but predictions are locked — no race with users editing.

## Deliverables back to you

- Dry-run report: list of affected users, per-match old→new remap, plus any rows that had to be cleared.
- After apply: confirmation counts, and a quick spot-check on the M88 example from your screenshot.

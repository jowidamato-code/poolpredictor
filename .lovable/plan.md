## Goal
On the My Picks tab, for the knockout rounds (Round of 32 → Final, plus Third Place), show the **user's predicted teams** instead of "TBD", and once a match has been played, additionally render an **Actual** row showing the actual teams and actual score (mirroring the existing "Your pick / Actual" pattern used in the group stage). This must also apply when viewing another participant's picks via the Standings drill-down (same component is reused).

This is purely a cosmetic/presentation change in `MyPredictionsTab.tsx`. No DB writes, no scoring logic changes, no route changes.

## Approach

In `src/components/tournament/MyPredictionsTab.tsx`:

1. Fetch what `deriveKnockoutTeams` needs (we already load `teams`, `matches`, `predictions`, and `bonus_predictions` — we just need to also load this user's `group_tiebreakers` row from the existing `tiebreakers` table; if that table isn't already used, fall back to `bonus_predictions.group_tiebreakers` and any existing third-place tiebreaker data the predictions module uses).
2. Build a `predictions` map keyed by match id and call `deriveKnockoutTeams(teams, matches, predMap, thirdPlaceTiebreakers, groupTiebreakers)` to get derived `team_a_id` / `team_b_id` for every knockout match.
3. For non-group rounds, when rendering each match card:
   - **Top row ("Your pick"):** show derived teams from the assignments map (with flags) alongside the existing predicted score boxes. Fall back to "TBD" only when the derivation truly couldn't resolve (e.g. earlier round not yet predicted).
   - **Bottom row ("Actual"):** if `match.played`, render a second row with the actual teams from `match.team_a_id` / `match.team_b_id` (using `teamMap`) and the actual score, styled like the existing primary-colored "Actual" block already used for group stage.
4. Group-stage rendering stays exactly as it is today.
5. Result badges (Exact / Result+GD / Result / Wrong / BTTS / points earned) keep using the actual match scores and the user's predicted scores — no change to that logic.

## Files
- `src/components/tournament/MyPredictionsTab.tsx` — only file edited.

## Out of scope
- No changes to scoring, DB schema, predictions saving, admin flows, or any other tab.
- No change to the group-stage card layout.
- "Your pick teams" in KO rounds reflect the user's **own** group-stage / KO predictions (consistent with how the Predictions tab already derives the bracket). They do not change as actual results come in — that's the point of showing the separate "Actual" row underneath.

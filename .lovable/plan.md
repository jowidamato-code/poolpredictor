## Problem

Two scoring bugs in K/O rounds:

1. **Team-to-advance (+2)** is awarded based on `match.winner_id` alone, ignoring whether the user's *predicted matchup* equals the actual matchup. Example: user picked Japan 1:1 Morocco → MAR advances. Actual was Netherlands 1:1 Morocco → MAR advanced. User got +2 wrongly. Conversely when user predicts a non-draw (e.g. Brazil 2:1 Japan exact), `predicted_team_through` is often `null`, so the +2 is silently skipped even though the matchup AND winner are exactly right.

2. **Round progression** is scored per-match: it compares the predicted winner of match X to the actual winner of match X. So a team the user correctly predicted to reach R16 yields 0 points if the user routed it through a different R32 slot. Per the new rule, progression must be team-level: if user predicted team T to reach round R, and T actually reached R, award round points regardless of route.

## Fix

### Team-to-advance (`src/lib/scoring.ts > scoreMatchPrediction`)

Award `config.team_through` for K/O matches ONLY when:
- `predictedTeamA === match.team_a_id` AND `predictedTeamB === match.team_b_id` (exact matchup), AND
- the user's chosen team-through equals `match.winner_id`.

Derive the user's team-through:
- If `pred.predicted_team_through` is set (draw case), use it.
- Else if the predicted scores are non-draw, infer it as the higher-scoring side of the *predicted* matchup (`predictedTeamA` if `score_a > score_b`, else `predictedTeamB`).

Signature change: add `predictedTeamA` / `predictedTeamB` params. Callers already derive the predicted bracket via `deriveKnockoutTeams` (used in `MyPredictionsTab` and available similarly in `StandingsTab`); pass `assignments[matchId].team_a_id/b_id` per K/O match. For group matches, pass `match.team_a_id/b_id` (matchup is fixed).

### Progression (`src/lib/scoring.ts > scoreDerivedProgression`)

Rewrite to be team-level, not match-level:

1. Compute **actual qualified teams per round** from `matches`: every distinct team appearing as `team_a_id`/`team_b_id` in any played-or-scheduled match of that round has "reached" that round. Champion = `winner_id` of the played final.
2. Compute **user's predicted qualified teams per round** from `deriveKnockoutTeams(...).assignments` (already used in the UI): the teams placed into R16/QF/SF/Final slots by the derivation engine, plus the user's predicted champion = predicted winner of the final.
3. For each team the user predicted at round R, if it's in the actual set for R, award the matching round points (`progression_r16`, `_qf`, `_sf`, `_final`, `_champion`).

Pass the same `teams`, `matches`, `predMap` (already a map of all match predictions), and `groupTiebreakers` already available at both call sites.

### Call-site updates

- `src/components/tournament/MyPredictionsTab.tsx`: pass derived predicted teams when calling `scoreMatchPrediction` for K/O matches; switch `scoreDerivedProgression` to the new signature with teams + derivation inputs.
- `src/components/tournament/StandingsTab.tsx`: build the per-user derivation once (matches with K/O team ids nulled, like the bracket views do), feed it into both updated functions.
- `src/routes/_authenticated/_admin/predictions.tsx` if it computes points the same way — verify and align.

### Data / migration

No DB schema or data migration. Scoring is recomputed on read everywhere, so the new logic takes effect immediately for live standings and "My Picks" point chips. Existing `predicted_team_through` values stay untouched.

### Verification

- Spot-check the two reported cards: M75 (Japan 1:1 Morocco prediction) should drop from +9 → +7 (loses the wrong +2); M76 (Brazil 2:1 Japan exact) should rise from +7 → +9 (gains the missing +2).
- Run the scoring through a couple of participants in console to confirm progression points appear for correctly-predicted advancing teams even when their R32 route was wrong.

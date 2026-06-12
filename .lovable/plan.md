## Plan: Show "team to advance" pick on K/O cards in My Picks

**Scope:** Visual only. `src/components/tournament/MyPredictionsTab.tsx`.

**Problem:** On K/O match cards (Round of 32 → Final), when the user predicted a draw, the card shows the score (e.g. 1:1) but doesn't indicate which team they picked to advance via penalties/ET. Same issue for the Actual row when the official result is a draw.

**Change:**
In the K/O card render block (around lines 283–347), for each row that is a knockout match (`isKO`) with a draw:

1. **Your pick row** — if `pred.predicted_score_a === pred.predicted_score_b` and `pred.predicted_team_through` is set, show a small line under the "Your pick" label like:
   `→ [flag] Team Name to advance`
   Styled with `text-[10px] text-muted-foreground` and primary-tinted team name.

2. **Actual row** — if `match.score_a === match.score_b` and `match.winner_id` is set, show the same style line under the "Actual" score:
   `→ [flag] Team Name advanced`
   Using `text-primary` tint to match the rest of the Actual row.

3. Add a tiny check/cross indicator when both predicted and actual advancing teams exist, marking whether the user's advancing-team pick matched the actual one. (Purely visual — no scoring changes.)

No other files touched. No business-logic or scoring changes.

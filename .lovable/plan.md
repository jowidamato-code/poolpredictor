
Good catch — BTTS is derivable from scores (both ≥ 1), so no extra UI needed for it. Same on the admin side: BTTS comes from the actual score entered.

Before I finalize, three quick choices:

**1. Player pool for award picks**
- (a) Admin populates manually via a new Players tab (empty until you add)
- (b) Pre-seed ~30 likely top players (Mbappé, Haaland, Bellingham, Vinicius, Messi, etc.), admin can edit
- (c) Free text — users type any name, admin enters actual winner as text, case-insensitive match

**2. Team Progression UI**
- (a) Bracket-style: user clicks the winner of each knockout match, R16/QF/SF/Final/Champion auto-derived from the bracket they already pick
- (b) Five independent multi-selects (pick 16, then 8, then 4, then 2, then 1) — more flexible, more work

**3. Bonus picks deadline**
- (a) Same single deadline locks everything (matches + bonus picks)
- (b) Bonus picks stay editable until tournament kicks off, matches lock at deadline

---

## Implementation plan (after answers)

### Database
New migration adds:
- `players` table (id, name, team_id, position) — only if not free-text
- `bonus_predictions` table (user_id, group_winners jsonb, group_runners_up jsonb, team_progression jsonb, top_scorer_id, golden_ball_id, young_player_id, most_assists_id, submitted_at) — `submitted_at` set on first save = tiebreaker
- `bonus_results` table (single admin-managed row mirroring the same shape)
- New columns on `predictions`: `predicted_team_through` (uuid, knockout only)

RLS: users read/write own bonus_predictions; everyone reads bonus_results & players; admins write bonus_results & players.

### Settings — full configurable point keys
Migration seeds these (replacing the old keys):
- Match: `points_winner_only` (3), `points_winner_gd` (4), `points_winner_exact_score` (6), `points_btts_bonus` (1), `points_team_through` (2, knockout)
- Group: `points_group_winner` (8), `points_group_runner_up` (5)
- Progression: `points_progression_r16` (4), `_qf` (6), `_sf` (10), `_final` (15), `_champion` (25)
- Awards: `points_top_scorer` (20), `points_golden_ball` (15), `points_young_player` (10), `points_most_assists` (10)

### UI changes

**User — Predictions tab**
- Knockout match rows get a "Team to advance" selector (shown only when scores are tied, since otherwise it's auto-derived from the score)
- BTTS is derived from the score the user already enters — no extra control

**User — new Bonus Picks sub-tab** inside Predictions:
- Group Winners & Runners-up (2 dropdowns per group)
- Team Progression (depends on choice 2)
- Player Awards (4 selectors — depends on choice 1)
- "Picks submitted at: [timestamp]" shown for tiebreaker transparency

**Admin Dashboard — new tabs**
- Match Results: extend with knockout "team that advanced" when scores are tied
- Bonus Results: enter actual group winners/runners, teams reaching each round, 4 award winners
- Players (only if not free-text): CRUD player pool

**Admin — Settings page**: rebuild Scoring card with all 15 point fields, grouped by Match / Group / Progression / Awards.

**Rules tab**: render the full points table grouped exactly as in your spec, values pulled live from settings, plus a note about the tiebreaker rule.

**Standings**: rewrite scoring engine in `src/lib/scoring.ts` to apply all rules, derive BTTS from scores, sort by points then earliest `submitted_at`.

### Files
**New:** `src/lib/scoring.ts`, `src/components/tournament/BonusPicksTab.tsx`, `src/routes/_authenticated/_admin/bonus-results.tsx`, optionally `_admin/players.tsx`, migration file.

**Edit:** `PredictionsTab.tsx`, `MatchScoreRow.tsx`, `RulesTab.tsx`, `StandingsTab.tsx`, `_admin/dashboard.tsx`, `_admin/settings.tsx`, `tournament-utils.ts`.

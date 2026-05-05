## Problem

Last turn I wrote `supabase/migrations/20260505202226_reset_tournament.sql` but never ran it against the database. Verified just now: 72 matches still have scores and `played = true`. Group results table is already empty (0 rows), so only the matches reset is outstanding.

## Fix

Run a migration that executes the same reset, this time actually applied to the database:

1. **`matches` — clear all results**
   ```sql
   UPDATE matches
   SET score_a = NULL, score_b = NULL, winner_id = NULL,
       played = false, match_date = NULL;
   ```

2. **`matches` — clear knockout bracket teams** (so the bracket re-derives from group results once those exist)
   ```sql
   UPDATE matches
   SET team_a_id = NULL, team_b_id = NULL
   WHERE round <> 'group';
   ```

3. **`group_results` — ensure empty** (already 0 rows, included as a no-op safety net)
   ```sql
   DELETE FROM group_results;
   ```

## Not touched (per your previous choice)

- User accounts, roles, profiles
- User predictions, bonus picks, bonus verdicts
- Teams, fixtures, settings, scoring config

## After approval

I'll switch to build mode, run the migration via the migration tool, then re-query to confirm `played_matches = 0` and `group_results = 0` so the admin dashboard shows a clean slate.
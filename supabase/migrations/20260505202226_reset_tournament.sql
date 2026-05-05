-- Reset tournament state for fresh launch.
-- Keeps user accounts, predictions, bonus picks, teams, and fixtures.
-- Wipes: match results, knockout bracket teams, group results.

UPDATE public.matches
SET score_a = NULL,
    score_b = NULL,
    winner_id = NULL,
    played = false,
    match_date = NULL;

UPDATE public.matches
SET team_a_id = NULL,
    team_b_id = NULL
WHERE round <> 'group';

DELETE FROM public.group_results;

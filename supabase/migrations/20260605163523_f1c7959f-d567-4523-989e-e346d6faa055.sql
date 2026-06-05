
ALTER TABLE public.group_results
  ADD COLUMN IF NOT EXISTS third_place_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fourth_place_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.bonus_predictions
  ADD COLUMN IF NOT EXISTS group_tiebreakers jsonb NOT NULL DEFAULT '[]'::jsonb;


-- Add predicted_team_through to predictions (knockout only)
ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS predicted_team_through uuid;

-- Bonus predictions per user
CREATE TABLE IF NOT EXISTS public.bonus_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  group_winners jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_runners_up jsonb NOT NULL DEFAULT '{}'::jsonb,
  team_progression jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_scorer text,
  golden_ball text,
  young_player text,
  most_assists text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bonus predictions"
ON public.bonus_predictions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all bonus predictions"
ON public.bonus_predictions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own bonus predictions"
ON public.bonus_predictions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bonus predictions"
ON public.bonus_predictions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own bonus predictions"
ON public.bonus_predictions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_bonus_predictions_updated_at
BEFORE UPDATE ON public.bonus_predictions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bonus results (admin)
CREATE TABLE IF NOT EXISTS public.bonus_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_winners jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_runners_up jsonb NOT NULL DEFAULT '{}'::jsonb,
  team_progression jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_scorer text,
  golden_ball text,
  young_player text,
  most_assists text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views bonus results"
ON public.bonus_results FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins insert bonus results"
ON public.bonus_results FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update bonus results"
ON public.bonus_results FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete bonus results"
ON public.bonus_results FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bonus_results_updated_at
BEFORE UPDATE ON public.bonus_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed/upsert scoring settings
INSERT INTO public.settings (key, value) VALUES
  ('points_winner_only', '3'::jsonb),
  ('points_winner_gd', '4'::jsonb),
  ('points_winner_exact_score', '6'::jsonb),
  ('points_btts_bonus', '1'::jsonb),
  ('points_team_through', '2'::jsonb),
  ('points_group_winner', '8'::jsonb),
  ('points_group_runner_up', '5'::jsonb),
  ('points_progression_r16', '4'::jsonb),
  ('points_progression_qf', '6'::jsonb),
  ('points_progression_sf', '10'::jsonb),
  ('points_progression_final', '15'::jsonb),
  ('points_progression_champion', '25'::jsonb),
  ('points_top_scorer', '20'::jsonb),
  ('points_golden_ball', '15'::jsonb),
  ('points_young_player', '10'::jsonb),
  ('points_most_assists', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

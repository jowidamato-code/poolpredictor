CREATE TABLE public.bonus_award_verdicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  award text NOT NULL CHECK (award IN ('top_scorer','golden_ball','young_player','most_assists')),
  verdict text NOT NULL CHECK (verdict IN ('won','lost')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, award)
);

ALTER TABLE public.bonus_award_verdicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views verdicts"
  ON public.bonus_award_verdicts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins insert verdicts"
  ON public.bonus_award_verdicts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update verdicts"
  ON public.bonus_award_verdicts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete verdicts"
  ON public.bonus_award_verdicts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER bonus_award_verdicts_updated_at
  BEFORE UPDATE ON public.bonus_award_verdicts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
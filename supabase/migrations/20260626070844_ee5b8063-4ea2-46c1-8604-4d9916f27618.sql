
DROP POLICY IF EXISTS "Users insert own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users insert own bonus predictions"
  ON public.bonus_predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users update own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users update own bonus predictions"
  ON public.bonus_predictions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked())
  WITH CHECK (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users delete own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users delete own bonus predictions"
  ON public.bonus_predictions FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked());

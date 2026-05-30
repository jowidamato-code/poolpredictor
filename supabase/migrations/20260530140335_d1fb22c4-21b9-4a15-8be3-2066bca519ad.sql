-- Add deadline guards to prediction write policies so users cannot
-- insert/update/delete picks after the deadline via direct API calls.
-- predictions_unlocked() returns true once the deadline has passed.

-- predictions: gate INSERT/UPDATE/DELETE on the deadline
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.predictions;
CREATE POLICY "Users can insert own predictions"
  ON public.predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users can update own predictions" ON public.predictions;
CREATE POLICY "Users can update own predictions"
  ON public.predictions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users can delete own predictions" ON public.predictions;
CREATE POLICY "Users can delete own predictions"
  ON public.predictions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked());

-- bonus_predictions: gate INSERT/UPDATE/DELETE on the deadline
DROP POLICY IF EXISTS "Users insert own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users insert own bonus predictions"
  ON public.bonus_predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users update own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users update own bonus predictions"
  ON public.bonus_predictions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked());

DROP POLICY IF EXISTS "Users delete own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users delete own bonus predictions"
  ON public.bonus_predictions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND NOT public.predictions_unlocked());
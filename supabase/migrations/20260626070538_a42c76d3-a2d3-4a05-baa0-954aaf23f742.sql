
-- Helper: read allow_late_predictions setting
CREATE OR REPLACE FUNCTION public.late_predictions_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::boolean
       FROM public.settings
      WHERE key = 'allow_late_predictions'
      LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.late_predictions_allowed() TO anon, authenticated;

-- ============ predictions: gate writes to knockout rounds when late mode ON ============
DROP POLICY IF EXISTS "Users can insert own predictions" ON public.predictions;
CREATE POLICY "Users can insert own predictions"
  ON public.predictions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT public.predictions_unlocked()
      OR (
        public.late_predictions_allowed()
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = predictions.match_id
            AND m.round <> 'group'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own predictions" ON public.predictions;
CREATE POLICY "Users can update own predictions"
  ON public.predictions FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      NOT public.predictions_unlocked()
      OR (
        public.late_predictions_allowed()
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = predictions.match_id
            AND m.round <> 'group'
        )
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT public.predictions_unlocked()
      OR (
        public.late_predictions_allowed()
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = predictions.match_id
            AND m.round <> 'group'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own predictions" ON public.predictions;
CREATE POLICY "Users can delete own predictions"
  ON public.predictions FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      NOT public.predictions_unlocked()
      OR (
        public.late_predictions_allowed()
        AND EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = predictions.match_id
            AND m.round <> 'group'
        )
      )
    )
  );

-- ============ bonus_predictions: allow writes whenever late mode ON ============
DROP POLICY IF EXISTS "Users insert own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users insert own bonus predictions"
  ON public.bonus_predictions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (NOT public.predictions_unlocked() OR public.late_predictions_allowed())
  );

DROP POLICY IF EXISTS "Users update own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users update own bonus predictions"
  ON public.bonus_predictions FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND (NOT public.predictions_unlocked() OR public.late_predictions_allowed())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (NOT public.predictions_unlocked() OR public.late_predictions_allowed())
  );

DROP POLICY IF EXISTS "Users delete own bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Users delete own bonus predictions"
  ON public.bonus_predictions FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND (NOT public.predictions_unlocked() OR public.late_predictions_allowed())
  );

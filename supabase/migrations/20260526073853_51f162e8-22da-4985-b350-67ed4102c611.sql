CREATE OR REPLACE FUNCTION public.predictions_unlocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::timestamptz <= now()
       FROM public.settings
      WHERE key = 'prediction_deadline'
      LIMIT 1),
    false
  )
$$;

DROP POLICY IF EXISTS "Authenticated can view all predictions" ON public.predictions;
CREATE POLICY "Authenticated view predictions after deadline"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (public.predictions_unlocked());

DROP POLICY IF EXISTS "Authenticated can view all bonus predictions" ON public.bonus_predictions;
CREATE POLICY "Authenticated view bonus predictions after deadline"
  ON public.bonus_predictions
  FOR SELECT
  TO authenticated
  USING (public.predictions_unlocked());

DROP POLICY IF EXISTS "Authenticated can view all roles" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.predictions_unlocked() TO anon, authenticated;
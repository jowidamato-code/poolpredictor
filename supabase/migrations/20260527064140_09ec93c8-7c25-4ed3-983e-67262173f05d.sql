
CREATE OR REPLACE FUNCTION public.get_excluded_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role IN ('admin','test_user');
$$;

REVOKE EXECUTE ON FUNCTION public.get_excluded_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excluded_user_ids() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin';
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated, anon;

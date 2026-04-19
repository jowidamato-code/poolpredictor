-- Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Restrict settings SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;
CREATE POLICY "Authenticated users can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);
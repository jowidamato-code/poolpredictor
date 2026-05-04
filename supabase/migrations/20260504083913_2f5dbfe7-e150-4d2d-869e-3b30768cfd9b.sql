CREATE POLICY "Authenticated can view all predictions"
ON public.predictions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can view all bonus predictions"
ON public.bonus_predictions
FOR SELECT
TO authenticated
USING (true);
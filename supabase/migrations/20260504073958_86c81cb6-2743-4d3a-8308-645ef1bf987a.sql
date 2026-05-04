CREATE TABLE public.group_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name text NOT NULL UNIQUE,
  winner_team_id uuid,
  runner_up_team_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views group results"
ON public.group_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert group results"
ON public.group_results FOR INSERT TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update group results"
ON public.group_results FOR UPDATE TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete group results"
ON public.group_results FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_group_results_updated_at
BEFORE UPDATE ON public.group_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
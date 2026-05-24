ALTER TABLE public.bonus_predictions
ADD COLUMN IF NOT EXISTS third_place_tiebreakers jsonb NOT NULL DEFAULT '[]'::jsonb;
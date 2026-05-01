INSERT INTO public.settings (key, value) VALUES
  ('entry_fee_amount', '20'::jsonb),
  ('admin_fee_pct', '10'::jsonb),
  ('prize_split_1st', '50'::jsonb),
  ('prize_split_2nd', '30'::jsonb),
  ('prize_split_3rd', '20'::jsonb),
  ('currency', '"€"'::jsonb)
ON CONFLICT (key) DO NOTHING;
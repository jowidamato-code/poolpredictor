
-- Detach matches from the old team rows so we can replace them
UPDATE public.matches SET team_a_id = NULL, team_b_id = NULL, winner_id = NULL;

-- Wipe the old (pre-draw) teams
DELETE FROM public.teams;

-- Seed the actual 2026 FIFA World Cup final-draw groups (announced 5 Dec 2025).
-- Placeholders are used for the 6 qualification slots still to be decided.
INSERT INTO public.teams (group_name, code, name) VALUES
  -- Group A
  ('A', 'MEX',  'Mexico'),
  ('A', 'RSA',  'South Africa'),
  ('A', 'KOR',  'South Korea'),
  ('A', 'PO_D', 'Winner European Play-Off D'),
  -- Group B
  ('B', 'CAN',  'Canada'),
  ('B', 'PO_A', 'Winner European Play-Off A'),
  ('B', 'QAT',  'Qatar'),
  ('B', 'SUI',  'Switzerland'),
  -- Group C
  ('C', 'BRA',  'Brazil'),
  ('C', 'MAR',  'Morocco'),
  ('C', 'HAI',  'Haiti'),
  ('C', 'SCO',  'Scotland'),
  -- Group D
  ('D', 'USA',  'USA'),
  ('D', 'PAR',  'Paraguay'),
  ('D', 'AUS',  'Australia'),
  ('D', 'PO_C', 'Winner European Play-Off C'),
  -- Group E
  ('E', 'GER',  'Germany'),
  ('E', 'CUW',  'Curaçao'),
  ('E', 'CIV',  'Ivory Coast'),
  ('E', 'ECU',  'Ecuador'),
  -- Group F
  ('F', 'NED',  'Netherlands'),
  ('F', 'JPN',  'Japan'),
  ('F', 'PO_B', 'Winner European Play-Off B'),
  ('F', 'TUN',  'Tunisia'),
  -- Group G
  ('G', 'BEL',  'Belgium'),
  ('G', 'EGY',  'Egypt'),
  ('G', 'IRN',  'Iran'),
  ('G', 'NZL',  'New Zealand'),
  -- Group H
  ('H', 'ESP',  'Spain'),
  ('H', 'CPV',  'Cape Verde'),
  ('H', 'KSA',  'Saudi Arabia'),
  ('H', 'URU',  'Uruguay'),
  -- Group I
  ('I', 'FRA',  'France'),
  ('I', 'SEN',  'Senegal'),
  ('I', 'FPO2', 'Winner FIFA Play-Off Tournament 2'),
  ('I', 'NOR',  'Norway'),
  -- Group J
  ('J', 'ARG',  'Argentina'),
  ('J', 'ALG',  'Algeria'),
  ('J', 'AUT',  'Austria'),
  ('J', 'JOR',  'Jordan'),
  -- Group K
  ('K', 'POR',  'Portugal'),
  ('K', 'FPO1', 'Winner FIFA Play-Off Tournament 1'),
  ('K', 'UZB',  'Uzbekistan'),
  ('K', 'COL',  'Colombia'),
  -- Group L
  ('L', 'ENG',  'England'),
  ('L', 'CRO',  'Croatia'),
  ('L', 'GHA',  'Ghana'),
  ('L', 'PAN',  'Panama');

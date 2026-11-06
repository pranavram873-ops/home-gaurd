-- Add the five divisions used by the personnel directory as selectable districts.
-- ON CONFLICT keeps this safe when a district already exists by code.
INSERT INTO public.districts (name, code, headquarters)
VALUES
  ('Avinashi', 'AVN', 'Avinashi'),
  ('Dharapuram', 'DHP', 'Dharapuram'),
  ('Kangeyam', 'KGM', 'Kangeyam'),
  ('Palladam', 'PLM', 'Palladam'),
  ('Udumalaipettai', 'UDP', 'Udumalaipettai')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    headquarters = EXCLUDED.headquarters;

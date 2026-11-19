ALTER TABLE public.home_guard_roster
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS joining_date DATE;

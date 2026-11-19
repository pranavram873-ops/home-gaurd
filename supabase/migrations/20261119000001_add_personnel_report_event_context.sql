ALTER TABLE public.personnel_reports
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS event_date DATE;

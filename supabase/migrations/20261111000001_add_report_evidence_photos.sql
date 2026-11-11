-- Store optional compressed evidence photos with both report types.
ALTER TABLE public.personnel_reports
  ADD COLUMN IF NOT EXISTS evidence_photo TEXT;

ALTER TABLE public.guard_reports
  ADD COLUMN IF NOT EXISTS evidence_photo TEXT;

NOTIFY pgrst, 'reload schema';

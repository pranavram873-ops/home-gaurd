-- Keep the thumbnail and the downloadable single-page PDF together on reports.
ALTER TABLE public.personnel_reports
  ADD COLUMN IF NOT EXISTS evidence_document TEXT;

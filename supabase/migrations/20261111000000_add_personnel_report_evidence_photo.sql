-- Optional evidence photo (compressed data URL) attached to a personnel report.
ALTER TABLE public.personnel_reports ADD COLUMN IF NOT EXISTS evidence_photo TEXT;

NOTIFY pgrst, 'reload schema';

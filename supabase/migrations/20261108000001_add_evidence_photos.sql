-- Add evidence_photos array column to muster_events for storing event evidence photo URLs/data.
ALTER TABLE public.muster_events ADD COLUMN IF NOT EXISTS evidence_photos TEXT[] DEFAULT '{}';

-- Add photo_url column to daily_attendance for storing per-guard attendance evidence photo.
ALTER TABLE public.daily_attendance ADD COLUMN IF NOT EXISTS photo_url TEXT;

NOTIFY pgrst, 'reload schema';

-- Add address column to muster_events for storing event venue/location details.
ALTER TABLE public.muster_events ADD COLUMN IF NOT EXISTS address TEXT;

NOTIFY pgrst, 'reload schema';

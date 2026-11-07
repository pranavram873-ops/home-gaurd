-- Let the authenticated admin dashboard receive new memo insert events.
-- RLS on guard_reports still determines which rows an admin can read.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'guard_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_reports;
  END IF;
END
$$;

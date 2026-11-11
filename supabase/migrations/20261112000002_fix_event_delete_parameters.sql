-- Event cards use a division/date key, so accept that pair instead of a UUID.
-- This replaces the earlier RPC signature without changing its admin-only behavior.
DROP FUNCTION IF EXISTS public.delete_muster_event_and_attendance(UUID);

CREATE OR REPLACE FUNCTION public.delete_muster_event_and_attendance(
  p_division_id UUID,
  p_event_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT (SELECT public.is_admin()) OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.role = 'admin'
      AND profile.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only active administrators can delete events.'
      USING ERRCODE = '42501';
  END IF;

  SELECT event.id
    INTO v_event_id
  FROM public.muster_events AS event
  WHERE event.division_id = p_division_id
    AND event.event_date = p_event_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.daily_attendance AS attendance
  WHERE attendance.division_id = p_division_id
    AND attendance.attendance_date = p_event_date;

  DELETE FROM public.muster_events AS event
  WHERE event.id = v_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not delete the event.' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_muster_event_and_attendance(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_muster_event_and_attendance(UUID, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';

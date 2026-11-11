-- Delete a muster event and its division/date attendance marks atomically.
-- The event's participant rows are removed by their existing ON DELETE CASCADE.
CREATE OR REPLACE FUNCTION public.delete_muster_event_and_attendance(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_division_id UUID;
  v_event_date DATE;
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

  SELECT event.division_id, event.event_date
    INTO v_division_id, v_event_date
  FROM public.muster_events AS event
  WHERE event.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.daily_attendance AS attendance
  WHERE attendance.division_id = v_division_id
    AND attendance.attendance_date = v_event_date;

  DELETE FROM public.muster_events AS event
  WHERE event.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not delete the event.' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_muster_event_and_attendance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_muster_event_and_attendance(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- The admin event list can contain dates with attendance marks but no named
-- muster_events row. Those cards must still be removable by an administrator.
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
  v_deleted_attendance BIGINT := 0;
  v_deleted_event BIGINT := 0;
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

  DELETE FROM public.daily_attendance AS attendance
  WHERE attendance.division_id = p_division_id
    AND attendance.attendance_date = p_event_date;
  GET DIAGNOSTICS v_deleted_attendance = ROW_COUNT;

  IF v_event_id IS NOT NULL THEN
    DELETE FROM public.muster_events AS event
    WHERE event.id = v_event_id;
    GET DIAGNOSTICS v_deleted_event = ROW_COUNT;
  END IF;

  IF v_deleted_attendance = 0 AND v_deleted_event = 0 THEN
    RAISE EXCEPTION 'No event or attendance records were found for that division and date.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_muster_event_and_attendance(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_muster_event_and_attendance(UUID, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';

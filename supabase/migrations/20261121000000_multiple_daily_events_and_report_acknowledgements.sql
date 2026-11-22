-- Allow independent muster events on the same division/date. Attendance is
-- linked to its event so marking one event cannot overwrite another.
ALTER TABLE public.muster_events
  DROP CONSTRAINT IF EXISTS muster_events_division_date_key;

ALTER TABLE public.daily_attendance
  ADD COLUMN IF NOT EXISTS event_id UUID
    REFERENCES public.muster_events(id) ON DELETE CASCADE;

UPDATE public.daily_attendance AS attendance
SET event_id = event.id
FROM public.muster_events AS event
WHERE attendance.event_id IS NULL
  AND event.division_id = attendance.division_id
  AND event.event_date = attendance.attendance_date;

ALTER TABLE public.daily_attendance
  DROP CONSTRAINT IF EXISTS daily_attendance_guard_id_attendance_date_key;

ALTER TABLE public.daily_attendance
  ADD CONSTRAINT daily_attendance_guard_event_key UNIQUE (guard_id, event_id);

CREATE INDEX IF NOT EXISTS idx_muster_events_division_date
  ON public.muster_events (division_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_event
  ON public.daily_attendance (event_id, guard_id);

DROP POLICY IF EXISTS "Active staff mark daily attendance" ON public.daily_attendance;
CREATE POLICY "Active staff mark daily attendance" ON public.daily_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = (SELECT auth.uid())
    AND event_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.home_guard_roster AS guard
      JOIN public.muster_events AS event ON event.division_id = guard.division_id
      WHERE guard.id = public.daily_attendance.guard_id
        AND guard.division_id = public.daily_attendance.division_id
        AND event.id = public.daily_attendance.event_id
        AND event.event_date = public.daily_attendance.attendance_date
    )
  );

DROP POLICY IF EXISTS "Active staff correct daily attendance" ON public.daily_attendance;
CREATE POLICY "Active staff correct daily attendance" ON public.daily_attendance
  FOR UPDATE TO authenticated
  USING (public.can_use_attendance_register())
  WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = (SELECT auth.uid())
    AND event_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.home_guard_roster AS guard
      JOIN public.muster_events AS event ON event.division_id = guard.division_id
      WHERE guard.id = public.daily_attendance.guard_id
        AND guard.division_id = public.daily_attendance.division_id
        AND event.id = public.daily_attendance.event_id
        AND event.event_date = public.daily_attendance.attendance_date
    )
  );

-- Administrators acknowledge a division report with a required action taken.
ALTER TABLE public.personnel_reports
  ADD COLUMN IF NOT EXISTS action_taken TEXT
    CHECK (action_taken IS NULL OR char_length(action_taken) BETWEEN 1 AND 2000),
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS personnel_reports_created_division_idx
  ON public.personnel_reports (created_at DESC, division_id);
CREATE INDEX IF NOT EXISTS personnel_reports_pending_ack_idx
  ON public.personnel_reports (created_at DESC)
  WHERE acknowledged_at IS NULL;

GRANT UPDATE (action_taken) ON public.personnel_reports TO authenticated;

DROP POLICY IF EXISTS "Admins acknowledge personnel reports" ON public.personnel_reports;
CREATE POLICY "Admins acknowledge personnel reports"
  ON public.personnel_reports FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.record_personnel_report_acknowledgement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.filed_by IS DISTINCT FROM OLD.filed_by
     OR NEW.reporter_name IS DISTINCT FROM OLD.reporter_name
     OR NEW.reporter_personnel_id IS DISTINCT FROM OLD.reporter_personnel_id
     OR NEW.guard_id IS DISTINCT FROM OLD.guard_id
     OR NEW.guard_name IS DISTINCT FROM OLD.guard_name
     OR NEW.home_guard_code IS DISTINCT FROM OLD.home_guard_code
     OR NEW.division_id IS DISTINCT FROM OLD.division_id
     OR NEW.division_name IS DISTINCT FROM OLD.division_name
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.event_name IS DISTINCT FROM OLD.event_name
     OR NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.evidence_photo IS DISTINCT FROM OLD.evidence_photo
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Filed report details cannot be changed.';
  END IF;

  IF NEW.action_taken IS DISTINCT FROM OLD.action_taken THEN
    IF auth.uid() IS NULL OR NULLIF(trim(NEW.action_taken), '') IS NULL THEN
      RAISE EXCEPTION 'Enter the action taken before acknowledging this report.';
    END IF;

    NEW.acknowledged_by := auth.uid();
    NEW.acknowledged_at := now();
    NEW.status := 'under_review';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_personnel_report_acknowledgement() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS record_personnel_report_acknowledgement_before_update ON public.personnel_reports;
CREATE TRIGGER record_personnel_report_acknowledgement_before_update
  BEFORE UPDATE ON public.personnel_reports
  FOR EACH ROW EXECUTE FUNCTION public.record_personnel_report_acknowledgement();

NOTIFY pgrst, 'reload schema';

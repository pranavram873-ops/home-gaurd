-- Named event header for each division/date in the existing daily muster.
-- Attendees remain the present rows in daily_attendance for that division/date.
CREATE TABLE IF NOT EXISTS public.muster_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.attendance_divisions(id) ON DELETE RESTRICT,
  event_date DATE NOT NULL,
  event_name TEXT NOT NULL CHECK (length(trim(event_name)) BETWEEN 2 AND 140),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT muster_events_division_date_key UNIQUE (division_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_muster_events_date_division
  ON public.muster_events (event_date DESC, division_id);

ALTER TABLE public.muster_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.muster_events FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.muster_events TO authenticated;

DROP POLICY IF EXISTS "Active staff view muster events" ON public.muster_events;
CREATE POLICY "Active staff view muster events" ON public.muster_events
  FOR SELECT TO authenticated
  USING (public.can_use_attendance_register());

DROP POLICY IF EXISTS "Admins and incharges create muster events" ON public.muster_events;
CREATE POLICY "Admins and incharges create muster events" ON public.muster_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_attendance_register()
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'incharge')
    )
  );

DROP POLICY IF EXISTS "Admins and incharges update muster events" ON public.muster_events;
CREATE POLICY "Admins and incharges update muster events" ON public.muster_events
  FOR UPDATE TO authenticated
  USING (public.can_use_attendance_register())
  WITH CHECK (
    public.can_use_attendance_register()
    AND created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'incharge')
    )
  );

-- New attendance marks must belong to an event header for the same district
-- and date. Existing historical marks remain readable and unchanged.
DROP POLICY IF EXISTS "Active staff mark daily attendance" ON public.daily_attendance;
CREATE POLICY "Active staff mark daily attendance" ON public.daily_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.home_guard_roster AS g
      WHERE g.id = public.daily_attendance.guard_id
        AND g.division_id = public.daily_attendance.division_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.muster_events AS e
      WHERE e.division_id = public.daily_attendance.division_id
        AND e.event_date = public.daily_attendance.attendance_date
    )
  );

DROP POLICY IF EXISTS "Active staff correct daily attendance" ON public.daily_attendance;
CREATE POLICY "Active staff correct daily attendance" ON public.daily_attendance
  FOR UPDATE TO authenticated
  USING (public.can_use_attendance_register())
  WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.home_guard_roster AS g
      WHERE g.id = public.daily_attendance.guard_id
        AND g.division_id = public.daily_attendance.division_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.muster_events AS e
      WHERE e.division_id = public.daily_attendance.division_id
        AND e.event_date = public.daily_attendance.attendance_date
    )
  );

NOTIFY pgrst, 'reload schema';

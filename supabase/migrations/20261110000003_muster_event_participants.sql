-- Personnel selected for an individual muster event.
CREATE TABLE IF NOT EXISTS public.muster_event_participants (
  event_id UUID NOT NULL REFERENCES public.muster_events(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES public.home_guard_roster(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, guard_id)
);

ALTER TABLE public.muster_event_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.muster_event_participants FROM anon;
GRANT SELECT, INSERT, DELETE ON public.muster_event_participants TO authenticated;

CREATE POLICY "Active staff view event participants" ON public.muster_event_participants
  FOR SELECT TO authenticated USING (public.can_use_attendance_register());
CREATE POLICY "Active staff manage event participants" ON public.muster_event_participants
  FOR INSERT TO authenticated WITH CHECK (
    public.can_use_attendance_register()
    AND EXISTS (SELECT 1 FROM public.muster_events e WHERE e.id = event_id)
    AND EXISTS (SELECT 1 FROM public.home_guard_roster g JOIN public.muster_events e ON e.division_id = g.division_id WHERE g.id = guard_id AND e.id = event_id)
  );
CREATE POLICY "Active staff remove event participants" ON public.muster_event_participants
  FOR DELETE TO authenticated USING (public.can_use_attendance_register());

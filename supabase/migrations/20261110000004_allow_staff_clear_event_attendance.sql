-- Admins and incharges can clear a mark when a guard is removed from an event.
GRANT DELETE ON public.daily_attendance TO authenticated;

DROP POLICY IF EXISTS "Active staff clear daily attendance" ON public.daily_attendance;
CREATE POLICY "Active staff clear daily attendance"
  ON public.daily_attendance FOR DELETE TO authenticated
  USING (public.can_use_attendance_register());

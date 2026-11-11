-- Permit active admins and incharges to delete a muster event header.
-- Daily attendance rows are retained as historical records.
GRANT DELETE ON public.muster_events TO authenticated;

DROP POLICY IF EXISTS "Admins and incharges delete muster events" ON public.muster_events;
CREATE POLICY "Admins and incharges delete muster events"
  ON public.muster_events FOR DELETE TO authenticated
  USING (
    public.can_use_attendance_register()
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'incharge')
        AND p.account_status = 'active'
    )
  );

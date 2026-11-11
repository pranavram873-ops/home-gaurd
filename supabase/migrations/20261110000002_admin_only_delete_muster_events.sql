-- Event deletion is an administrator-only action. Incharges retain create and
-- update access through the existing policies, but cannot delete event rows.
GRANT DELETE ON public.muster_events TO authenticated;

DROP POLICY IF EXISTS "Admins and incharges delete muster events" ON public.muster_events;
DROP POLICY IF EXISTS "Admins delete muster events" ON public.muster_events;

CREATE POLICY "Admins delete muster events"
  ON public.muster_events FOR DELETE TO authenticated
  USING (
    (SELECT public.is_admin())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_status = 'active'
    )
  );

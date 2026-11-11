-- Let authenticated attendance users read personnel reports for roster
-- divisions. The client still filters by the currently selected division.
DROP POLICY IF EXISTS "Incharges see their own personnel reports and admins see all"
  ON public.personnel_reports;
DROP POLICY IF EXISTS "Incharges see division personnel reports and admins see all"
  ON public.personnel_reports;

CREATE POLICY "Incharges see division personnel reports and admins see all"
  ON public.personnel_reports FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR filed_by = (SELECT auth.uid())
    OR (
      (SELECT public.can_use_attendance_register())
      AND EXISTS (
        SELECT 1
        FROM public.home_guard_roster roster
        WHERE roster.id = personnel_reports.guard_id
          AND roster.division_id = personnel_reports.division_id
      )
    )
  );

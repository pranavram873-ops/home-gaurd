-- Allow only administrators to delete personnel reports.
GRANT DELETE ON public.personnel_reports TO authenticated;

DROP POLICY IF EXISTS "Admins can delete personnel reports"
  ON public.personnel_reports;

CREATE POLICY "Admins can delete personnel reports"
  ON public.personnel_reports
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

NOTIFY pgrst, 'reload schema';

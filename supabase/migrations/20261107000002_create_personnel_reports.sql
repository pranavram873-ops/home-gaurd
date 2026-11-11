-- District incharges file observations against the attendance roster. Report
-- snapshots preserve the names and district shown at filing time.

CREATE TABLE public.personnel_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reporter_name TEXT NOT NULL,
  reporter_personnel_id TEXT,
  guard_id UUID NOT NULL REFERENCES public.home_guard_roster(id) ON DELETE RESTRICT,
  guard_name TEXT NOT NULL,
  home_guard_code TEXT NOT NULL,
  division_id UUID NOT NULL REFERENCES public.attendance_divisions(id) ON DELETE RESTRICT,
  division_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('conduct', 'attendance', 'safety', 'other')),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (filed_by IS NOT NULL)
);

CREATE INDEX personnel_reports_filed_by_created_idx ON public.personnel_reports (filed_by, created_at DESC);
CREATE INDEX personnel_reports_division_created_idx ON public.personnel_reports (division_id, created_at DESC);
ALTER TABLE public.personnel_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personnel_reports FROM anon, authenticated;
GRANT SELECT, INSERT ON public.personnel_reports TO authenticated;

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

CREATE POLICY "Active incharges can file roster personnel reports"
  ON public.personnel_reports FOR INSERT TO authenticated
  WITH CHECK (
    filed_by = (SELECT auth.uid())
    AND (SELECT public.can_use_attendance_register())
  );

CREATE OR REPLACE FUNCTION public.prepare_personnel_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reporter public.profiles%ROWTYPE;
  v_guard public.home_guard_roster%ROWTYPE;
  v_division_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR NEW.filed_by <> auth.uid() THEN
    RAISE EXCEPTION 'Reports must be filed by the signed-in user.';
  END IF;

  SELECT * INTO v_reporter
  FROM public.profiles
  WHERE id = NEW.filed_by AND account_status = 'active' AND role IN ('incharge', 'admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only active incharges and administrators can file personnel reports.';
  END IF;

  SELECT * INTO v_guard
  FROM public.home_guard_roster
  WHERE id = NEW.guard_id AND division_id = NEW.division_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select an active Home Guard from the chosen division.';
  END IF;

  SELECT name INTO v_division_name FROM public.attendance_divisions WHERE id = NEW.division_id;
  NEW.reporter_name := v_reporter.full_name;
  NEW.reporter_personnel_id := v_reporter.personnel_id;
  NEW.guard_name := v_guard.full_name;
  NEW.home_guard_code := v_guard.home_guard_code;
  NEW.division_name := v_division_name;
  NEW.status := 'submitted';
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_personnel_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prepare_personnel_report_before_insert
  BEFORE INSERT ON public.personnel_reports
  FOR EACH ROW EXECUTE FUNCTION public.prepare_personnel_report();

NOTIFY pgrst, 'reload schema';

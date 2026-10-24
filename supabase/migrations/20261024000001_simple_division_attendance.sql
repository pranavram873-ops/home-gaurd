-- Simple division-based daily attendance register.
-- The existing geofence check-in tables remain untouched; this is a separate
-- roster workflow for incharges to record present/absent for a duty day.

CREATE TABLE IF NOT EXISTS public.attendance_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.attendance_divisions (code, name) VALUES
  ('AVN', 'Avinashi'),
  ('DHP', 'Dharapuram'),
  ('KGM', 'Kangeyam'),
  ('PLM', 'Palladam'),
  ('UDP', 'Udumalaipettai')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Existing non-admin sign-ins become incharges. Keep the legacy value accepted
-- for old signup hooks and historical application code, but the current app
-- labels and routes those accounts as Incharge.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'incharge', 'home_guard'));
ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_escalation;
UPDATE public.profiles SET role = 'incharge', updated_at = now()
WHERE role = 'home_guard';
ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_escalation;

CREATE TABLE IF NOT EXISTS public.home_guard_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.attendance_divisions(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
  phone TEXT NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  home_guard_code TEXT NOT NULL UNIQUE CHECK (length(trim(home_guard_code)) BETWEEN 2 AND 40),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES public.home_guard_roster(id) ON DELETE RESTRICT,
  division_id UUID NOT NULL REFERENCES public.attendance_divisions(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  marked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guard_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_home_guard_roster_division_active
  ON public.home_guard_roster (division_id, full_name) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_daily_attendance_division_date
  ON public.daily_attendance (division_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_guard_date
  ON public.daily_attendance (guard_id, attendance_date);

CREATE OR REPLACE FUNCTION public.can_use_attendance_register()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
      AND role IN ('admin', 'incharge', 'home_guard')
  );
$$;
REVOKE ALL ON FUNCTION public.can_use_attendance_register() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_attendance_register() TO authenticated;

ALTER TABLE public.attendance_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_guard_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active staff view attendance divisions" ON public.attendance_divisions
  FOR SELECT TO authenticated USING (public.can_use_attendance_register());
CREATE POLICY "Admins manage attendance divisions" ON public.attendance_divisions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Active staff view guard roster" ON public.home_guard_roster
  FOR SELECT TO authenticated USING (public.can_use_attendance_register());
CREATE POLICY "Admins add guards to roster" ON public.home_guard_roster
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update guard roster" ON public.home_guard_roster
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Active staff view daily attendance" ON public.daily_attendance
  FOR SELECT TO authenticated USING (public.can_use_attendance_register());
CREATE POLICY "Active staff mark daily attendance" ON public.daily_attendance
  FOR INSERT TO authenticated WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.home_guard_roster g
      WHERE g.id = public.daily_attendance.guard_id
        AND g.division_id = public.daily_attendance.division_id
    )
  );
CREATE POLICY "Active staff correct daily attendance" ON public.daily_attendance
  FOR UPDATE TO authenticated USING (public.can_use_attendance_register())
  WITH CHECK (
    public.can_use_attendance_register()
    AND marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.home_guard_roster g
      WHERE g.id = public.daily_attendance.guard_id
        AND g.division_id = public.daily_attendance.division_id
    )
  );

GRANT SELECT ON public.attendance_divisions, public.home_guard_roster, public.daily_attendance TO authenticated;
GRANT INSERT, UPDATE ON public.daily_attendance TO authenticated;
GRANT INSERT, UPDATE ON public.home_guard_roster TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_divisions TO authenticated;

NOTIFY pgrst, 'reload schema';

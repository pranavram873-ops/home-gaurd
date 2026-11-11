-- Keep active Home Guard profiles available to both event attendance screens.
CREATE OR REPLACE FUNCTION public.sync_profile_to_home_guard_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_division_id UUID;
BEGIN
  IF NEW.role = 'home_guard'
    AND NEW.account_status = 'active'
    AND NEW.personnel_id IS NOT NULL
    AND length(trim(NEW.personnel_id)) BETWEEN 2 AND 40
    AND NEW.phone ~ '^[0-9]{10}$'
    AND NEW.district_id IS NOT NULL THEN
    SELECT attendance_division.id INTO v_division_id
    FROM public.districts AS district
    JOIN public.attendance_divisions AS attendance_division
      ON attendance_division.code = district.code
    WHERE district.id = NEW.district_id;

    IF v_division_id IS NOT NULL THEN
      INSERT INTO public.home_guard_roster (division_id, full_name, phone, home_guard_code, is_active)
      VALUES (v_division_id, NEW.full_name, NEW.phone, NEW.personnel_id, true)
      ON CONFLICT (home_guard_code) DO UPDATE SET
        division_id = EXCLUDED.division_id,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        is_active = true,
        updated_at = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.personnel_id IS NOT NULL THEN
    UPDATE public.home_guard_roster SET is_active = false, updated_at = now()
    WHERE home_guard_code = OLD.personnel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_to_home_guard_roster ON public.profiles;
CREATE TRIGGER sync_profile_to_home_guard_roster
AFTER INSERT OR UPDATE OF full_name, phone, personnel_id, role, account_status, district_id
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_home_guard_roster();

-- Backfill already active profiles (the earlier sync migration was one-time).
INSERT INTO public.home_guard_roster (division_id, full_name, phone, home_guard_code, is_active)
SELECT attendance_division.id, profile.full_name, profile.phone, profile.personnel_id, true
FROM public.profiles AS profile
JOIN public.districts AS district ON district.id = profile.district_id
JOIN public.attendance_divisions AS attendance_division ON attendance_division.code = district.code
WHERE profile.role = 'home_guard'
  AND profile.account_status = 'active'
  AND profile.personnel_id IS NOT NULL
  AND length(trim(profile.personnel_id)) BETWEEN 2 AND 40
  AND profile.phone ~ '^[0-9]{10}$'
ON CONFLICT (home_guard_code) DO UPDATE SET
  division_id = EXCLUDED.division_id,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  is_active = true,
  updated_at = now();

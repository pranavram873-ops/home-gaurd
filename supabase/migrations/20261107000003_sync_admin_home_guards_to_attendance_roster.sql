-- Admin-created Home Guard profiles and event attendance use separate tables.
-- Backfill existing active profiles so they are selectable in incharge events.
INSERT INTO public.home_guard_roster (
  division_id,
  full_name,
  phone,
  home_guard_code,
  is_active
)
SELECT
  attendance_division.id,
  profile.full_name,
  profile.phone,
  profile.personnel_id,
  true
FROM public.profiles AS profile
JOIN public.districts AS district
  ON district.id = profile.district_id
JOIN public.attendance_divisions AS attendance_division
  ON attendance_division.code = district.code
WHERE profile.role = 'home_guard'
  AND profile.account_status = 'active'
  AND profile.personnel_id IS NOT NULL
  AND length(trim(profile.personnel_id)) BETWEEN 2 AND 40
  AND profile.phone ~ '^[0-9]{10}$'
ON CONFLICT (home_guard_code) DO NOTHING;

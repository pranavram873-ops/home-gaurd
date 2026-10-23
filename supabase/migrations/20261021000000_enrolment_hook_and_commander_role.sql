-- ============================================================================
-- TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
-- Public enrolment hook for Supabase Auth + missing RLS helper
-- ============================================================================
-- Applied after 20261019000000_initial_schema.sql. Nothing here loosens an
-- existing policy: it adds the profile row that real sign-in requires, and
-- defines the helper two existing policies already reference.

-- ----------------------------------------------------------------------------
-- 1. `public.is_commander()` — referenced by the "Users view own attendance"
--    and "View event assignments" policies but never defined. Until it exists,
--    every authenticated SELECT on attendance_events / event_assignments fails
--    with `function public.is_commander() does not exist`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_commander()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'commander' AND account_status = 'active'
  );
$$;

-- The initial schema allowed only ('admin', 'home_guard'), so is_commander()
-- could never be true and an admin promoting someone to commander (the role the
-- application types already define) would be rejected by the database.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check,
    ADD CONSTRAINT profiles_role_check
        CHECK (role IN ('admin', 'commander', 'home_guard'));

-- ----------------------------------------------------------------------------
-- 2. Enrolment hook: create the `profiles` row when an Auth user is created.
--    Email confirmation is enabled on this project, so a new registrant has no
--    session yet and cannot insert their own profile row under RLS. Doing it in
--    the database also means role and account_status are never client input.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_meta     JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    v_district UUID;
    v_unit     UUID;
BEGIN
    IF NULLIF(TRIM(v_meta ->> 'district_code'), '') IS NOT NULL THEN
        SELECT id INTO v_district
        FROM public.districts
        WHERE code = TRIM(v_meta ->> 'district_code')
        LIMIT 1;
    END IF;

    IF NULLIF(TRIM(v_meta ->> 'unit_code'), '') IS NOT NULL THEN
        SELECT id INTO v_unit
        FROM public.units
        WHERE code = TRIM(v_meta ->> 'unit_code')
          AND (v_district IS NULL OR district_id = v_district)
        LIMIT 1;
    END IF;

    INSERT INTO public.profiles (
        id, full_name, email, phone, personnel_id, role, account_status,
        district_id, unit_id, rank_designation, emergency_contact, blood_group
    ) VALUES (
        NEW.id,
        COALESCE(NULLIF(TRIM(v_meta ->> 'full_name'), ''), 'Unnamed Applicant'),
        COALESCE(NEW.email, ''),
        NULLIF(TRIM(v_meta ->> 'phone'), ''),
        NULLIF(TRIM(v_meta ->> 'personnel_id'), ''),
        'home_guard',          -- fixed: enrolment can never request a privilege
        'pending',             -- fixed: an administrator must approve activation
        v_district,
        v_unit,
        'Recruit Applicant',
        NULLIF(TRIM(v_meta ->> 'emergency_contact'), ''),
        NULLIF(TRIM(v_meta ->> 'blood_group'), '')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Keep the roster's email in step with an approved email change in Auth.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.handle_user_email_change();

-- A first-admin bootstrap uses the server-only service key to promote the
-- trigger-created pending profile. Browser users must still pass the admin
-- check, so a publishable-key request cannot change role or approval status.
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
    v_role TEXT := current_setting('request.jwt.claim.role', true);
    v_is_service_role BOOLEAN;
BEGIN
    v_is_service_role := COALESCE(v_role = 'service_role', false)
        OR COALESCE(v_claims::jsonb ->> 'role' = 'service_role', false);

    IF NOT v_is_service_role AND NOT public.is_admin() THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Unauthorized: Only an Administrator may modify user roles.';
        END IF;
        IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
            RAISE EXCEPTION 'Unauthorized: Only an Administrator may alter account statuses.';
        END IF;
        IF NEW.district_id IS DISTINCT FROM OLD.district_id THEN
            RAISE EXCEPTION 'Unauthorized: Only an Administrator may transfer district assignments.';
        END IF;
        IF NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN
            RAISE EXCEPTION 'Unauthorized: Only an Administrator may modify unit assignments.';
        END IF;
    END IF;

    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

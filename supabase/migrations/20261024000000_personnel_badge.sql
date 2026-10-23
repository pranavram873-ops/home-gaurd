-- ============================================================================
-- TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
-- Service badge issuance on activation
-- ============================================================================
-- Applied after 20261023000000_remove_commander_role.sql. The application used
-- to invent badge numbers in the browser (dataService.approveRegistration),
-- which cannot honour the `profiles_personnel_id_key` UNIQUE constraint when two
-- administrators activate someone at the same moment. Issuing it here keeps the
-- collision check inside the database.

-- ----------------------------------------------------------------------------
-- assign_personnel_badge()
-- SECURITY DEFINER is required, not just convenient: a plain trigger runs as the
-- updating role, and RLS on `profiles` would hide every other row from the
-- uniqueness probe below, so a home guard editing their own record could never
-- see a clash. search_path is pinned because the function is definer-owned.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_personnel_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_candidate TEXT;
    v_attempts  INTEGER := 0;
BEGIN
    -- Only on the transition into 'active', and never over an existing badge.
    IF NEW.account_status <> 'active'
       OR OLD.account_status IS NOT DISTINCT FROM 'active'
       OR COALESCE(NEW.personnel_id, OLD.personnel_id) IS NOT NULL THEN
        RETURN NEW;
    END IF;

    LOOP
        -- md5(random() || clock_timestamp()) needs no extension, unlike
        -- gen_random_bytes(); five hex digits match the TN-HG-##### format
        -- the roster and printed badge templates already expect.
        v_candidate := 'TN-HG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));

        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE personnel_id = v_candidate
        ) THEN
            EXIT;
        END IF;

        v_attempts := v_attempts + 1;
        IF v_attempts > 20 THEN
            -- Give up rather than loop inside the write; the UNIQUE constraint
            -- will surface a clear error to the operator instead.
            EXIT;
        END IF;
    END LOOP;

    NEW.personnel_id := v_candidate;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_personnel_badge ON public.profiles;
CREATE TRIGGER assign_personnel_badge
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.assign_personnel_badge();

-- Trigger order note: Postgres fires same-timing row triggers alphabetically, so
-- this runs before protect_profile_privilege_escalation(). That is deliberate and
-- harmless — this function only ever writes `personnel_id`, which the escalation
-- guard does not compare, and the guard still sets `updated_at`.

-- PostgREST caches the schema; without this the new function is invisible until
-- the next auto-reload.
NOTIFY pgrst, 'reload schema';

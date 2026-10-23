-- ============================================================================
-- TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
-- Remove the Area Commander role: two tiers only (admin, home_guard)
-- ============================================================================
-- Supersedes the commander parts of
-- 20261021000000_enrolment_hook_and_commander_role.sql. Enrolment now goes
-- straight to an administrator, so nothing may grant commander-scoped reads.
-- Every change here narrows access; none of it loosens an existing policy.

-- ----------------------------------------------------------------------------
-- 1. Re-classify anyone still carrying the role. Existing commander rows were
--    supervisory views, not login privileges, so demoting them to `home_guard`
--    cannot leak authority. `rank_designation` is untouched, so the roster still
--    shows the person's official title.
-- ----------------------------------------------------------------------------
UPDATE public.profiles
SET role = 'home_guard',
    updated_at = now()
WHERE role = 'commander';

-- ----------------------------------------------------------------------------
-- 2. Drop the commander clauses from the two policies that used them.
--    "Users view own attendance" loses the district/unit inspection branch; an
--    administrator still sees every row and a volunteer only their own.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own attendance" ON public.attendance_events;
CREATE POLICY "Users view own attendance" ON public.attendance_events
    FOR SELECT TO authenticated USING (
        user_id = (SELECT auth.uid())
        OR (SELECT public.is_admin())
    );

DROP POLICY IF EXISTS "View event assignments" ON public.event_assignments;
CREATE POLICY "View event assignments" ON public.event_assignments
    FOR SELECT TO authenticated USING (
        personnel_id = (SELECT auth.uid())
        OR (SELECT public.is_admin())
    );

-- ----------------------------------------------------------------------------
-- 3. The helper is only droppable after step 2 removed its last dependency.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_commander();

-- ----------------------------------------------------------------------------
-- 4. Close the role domain. This is what makes an old `/commander` account
--    impossible to create or re-promote, and it fails loudly if step 1 missed a
--    row rather than silently accepting a value the application no longer knows.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check,
    ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'home_guard'));

-- `units.commander_id` and `events.commander_id` are kept on purpose: they are
-- foreign keys onto profiles identifying the officer in charge of a unit or
-- bandobast, not a login role. They now always reference an administrator.
--
-- The SQL Editor refreshes the PostgREST schema cache itself. If you ran this
-- some other way, reload it with: NOTIFY pgrst, 'reload schema';

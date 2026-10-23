-- Guard-to-guard and admin reporting with role-scoped visibility.

CREATE TABLE public.guard_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reporter_name TEXT NOT NULL,
    reporter_personnel_id TEXT,
    subject_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    subject_name TEXT NOT NULL,
    subject_personnel_id TEXT,
    category TEXT NOT NULL CHECK (category IN ('conduct', 'attendance', 'safety', 'other')),
    description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'under_review', 'resolved', 'dismissed')),
    resolution_note TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (reporter_id <> subject_id)
);

CREATE INDEX guard_reports_reporter_created_idx
    ON public.guard_reports (reporter_id, created_at DESC);
CREATE INDEX guard_reports_subject_created_idx
    ON public.guard_reports (subject_id, created_at DESC);
CREATE INDEX guard_reports_status_created_idx
    ON public.guard_reports (status, created_at DESC);

ALTER TABLE public.guard_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guard_reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.guard_reports TO authenticated;

CREATE POLICY "Report participants and admins can view reports"
    ON public.guard_reports FOR SELECT TO authenticated
    USING (
        reporter_id = (SELECT auth.uid())
        OR subject_id = (SELECT auth.uid())
        OR (SELECT public.is_admin())
    );

CREATE POLICY "Active personnel can submit reports"
    ON public.guard_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = (SELECT auth.uid()));

CREATE POLICY "Admins can update reports"
    ON public.guard_reports FOR UPDATE TO authenticated
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- Snapshot names for display, and validate both parties against trusted profiles.
-- The function is trigger-only; authenticated callers cannot invoke it directly.
CREATE OR REPLACE FUNCTION public.prepare_guard_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_reporter public.profiles%ROWTYPE;
    v_subject public.profiles%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR NEW.reporter_id <> auth.uid() THEN
        RAISE EXCEPTION 'Reports must be submitted by the signed-in user.';
    END IF;

    SELECT * INTO v_reporter
    FROM public.profiles
    WHERE id = NEW.reporter_id AND account_status = 'active'
      AND role IN ('home_guard', 'admin');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Only active Home Guards and administrators can submit reports.';
    END IF;

    SELECT * INTO v_subject
    FROM public.profiles
    WHERE id = NEW.subject_id AND account_status = 'active' AND role = 'home_guard';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'The report must be about an active Home Guard.';
    END IF;
    IF NEW.reporter_id = NEW.subject_id THEN
        RAISE EXCEPTION 'You cannot report yourself.';
    END IF;

    NEW.reporter_name := v_reporter.full_name;
    NEW.reporter_personnel_id := v_reporter.personnel_id;
    NEW.subject_name := v_subject.full_name;
    NEW.subject_personnel_id := v_subject.personnel_id;
    NEW.status := 'submitted';
    NEW.resolution_note := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_guard_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prepare_guard_report_before_insert
    BEFORE INSERT ON public.guard_reports
    FOR EACH ROW EXECUTE FUNCTION public.prepare_guard_report();

CREATE OR REPLACE FUNCTION public.protect_guard_report_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
       OR NEW.reporter_name IS DISTINCT FROM OLD.reporter_name
       OR NEW.reporter_personnel_id IS DISTINCT FROM OLD.reporter_personnel_id
       OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
       OR NEW.subject_name IS DISTINCT FROM OLD.subject_name
       OR NEW.subject_personnel_id IS DISTINCT FROM OLD.subject_personnel_id
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Report details cannot be changed after submission.';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER protect_guard_report_update_before_update
    BEFORE UPDATE ON public.guard_reports
    FOR EACH ROW EXECUTE FUNCTION public.protect_guard_report_update();

-- A tightly scoped directory RPC avoids granting broad profile-table access.
CREATE OR REPLACE FUNCTION public.list_reportable_home_guards()
RETURNS TABLE (id UUID, full_name TEXT, personnel_id TEXT, unit_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.account_status = 'active'
          AND p.role IN ('home_guard', 'admin')
    ) THEN
        RAISE EXCEPTION 'An active signed-in Home Guard or administrator is required.';
    END IF;

    RETURN QUERY
    SELECT p.id, p.full_name, p.personnel_id, p.unit_id
    FROM public.profiles p
    WHERE p.role = 'home_guard' AND p.account_status = 'active'
      AND p.id <> auth.uid()
    ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_reportable_home_guards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_reportable_home_guards() TO authenticated;

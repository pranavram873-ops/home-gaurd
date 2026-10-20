-- ============================================================================
-- TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
-- Initial Relational Database Schema & Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. DISTRICTS TABLE
CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    headquarters TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. UNITS TABLE
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    commander_id UUID, -- self-referencing to profiles(id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(district_id, code)
);

-- 3. PROFILES TABLE (Associated with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    personnel_id TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'home_guard' CHECK (role IN ('admin', 'home_guard')),
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    account_status TEXT NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')),
    rank_designation TEXT DEFAULT 'Home Guard Volunteer',
    avatar_url TEXT,
    emergency_contact TEXT,
    blood_group TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key constraint from units to profiles now that profiles exists
ALTER TABLE public.units 
DROP CONSTRAINT IF EXISTS fk_units_commander,
ADD CONSTRAINT fk_units_commander FOREIGN KEY (commander_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. DUTY LOCATIONS (GEOFENCES)
CREATE TABLE IF NOT EXISTS public.duty_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 150,
    district_id UUID REFERENCES public.districts(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DUTY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.duty_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    duty_location_id UUID REFERENCES public.duty_locations(id) ON DELETE SET NULL,
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    assigned_personnel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    duty_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'absent')),
    reporting_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ATTENDANCE EVENTS (CHECK-IN / CHECK-OUT WITH GEOFENCE VALIDATION)
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    duty_assignment_id UUID REFERENCES public.duty_assignments(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.duty_locations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    is_within_geofence BOOLEAN NOT NULL DEFAULT true,
    validation_status TEXT NOT NULL DEFAULT 'verified' CHECK (validation_status IN ('verified', 'flagged_distance', 'flagged_timing', 'manual_override')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_info TEXT,
    remarks TEXT
);

-- 7. TASKS & SUPERVISION
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    duty_assignment_id UUID REFERENCES public.duty_assignments(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TASK STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. EVENTS (EVENT PLANNER)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL DEFAULT 'bandobast' CHECK (event_type IN ('bandobast', 'crowd_control', 'traffic_management', 'emergency', 'ceremonial', 'training')),
    venue TEXT NOT NULL,
    duty_location_id UUID REFERENCES public.duty_locations(id) ON DELETE SET NULL,
    district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    commander_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    required_personnel INTEGER NOT NULL DEFAULT 10,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'concluded', 'cancelled')),
    duty_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. EVENT ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_in_event TEXT DEFAULT 'Volunteer Guard',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, personnel_id)
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'assignment', 'alert', 'approval', 'task', 'reminder')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & FILTERING
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district_id);
CREATE INDEX IF NOT EXISTS idx_profiles_unit ON public.profiles(unit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_personnel_id ON public.profiles(personnel_id);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_personnel ON public.duty_assignments(assigned_personnel_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_date ON public.duty_assignments(duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_status ON public.duty_assignments(status);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_unit ON public.duty_assignments(unit_id);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_assignment ON public.attendance_events(duty_assignment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_at ON public.attendance_events(recorded_at);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_unit ON public.tasks(unit_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ============================================================================
-- HELPER FUNCTIONS FOR SECURITY (Avoid recursive RLS policies)
-- ============================================================================

-- Function to get the active user's role securely
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND account_status = 'active';
$$;

-- Function to check if active user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin' AND account_status = 'active'
  );
$$;

-- Function to get active user's assigned district
CREATE OR REPLACE FUNCTION public.get_auth_district()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT district_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Function to get active user's assigned unit
CREATE OR REPLACE FUNCTION public.get_auth_unit()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT unit_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- --- DISTRICTS & UNITS POLICIES ---
-- All authenticated users can view districts and units
CREATE POLICY "Districts visible to authenticated" ON public.districts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Units visible to authenticated" ON public.units
    FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update/delete districts & units
CREATE POLICY "Admins manage districts" ON public.districts
    FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Admins manage units" ON public.units
    FOR ALL TO authenticated USING (public.is_admin());

-- --- PROFILES POLICIES ---
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT TO authenticated USING (public.is_admin());

-- Users can update basic non-privileged fields of their own profile
-- (Role & account_status changes are strictly prevented via trigger below)
CREATE POLICY "Users can update own profile non-privileged" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admins can update any profile (including role, status, unit, district)
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE TO authenticated USING (public.is_admin());

-- Profile creation during signup (authenticated user inserting own profile)
CREATE POLICY "Users can insert own initial profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- --- DUTY LOCATIONS POLICIES ---
CREATE POLICY "Locations viewable by active authenticated" ON public.duty_locations
    FOR SELECT TO authenticated USING (
        public.is_admin() OR 
        is_active = true
    );

CREATE POLICY "Admins manage duty locations" ON public.duty_locations
    FOR ALL TO authenticated USING (public.is_admin());

-- --- DUTY ASSIGNMENTS POLICIES ---
CREATE POLICY "Personnel view own assignments" ON public.duty_assignments
    FOR SELECT TO authenticated USING (
        assigned_personnel_id = auth.uid() OR
        public.is_admin()
    );

CREATE POLICY "Admins create assignments" ON public.duty_assignments
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins update assignments" ON public.duty_assignments
    FOR UPDATE TO authenticated USING (public.is_admin());

-- --- ATTENDANCE EVENTS POLICIES ---
CREATE POLICY "Users view own attendance" ON public.attendance_events
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR
        public.is_admin() OR
        (public.is_commander() AND EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = public.attendance_events.user_id 
              AND (p.district_id = public.get_auth_district() OR p.unit_id = public.get_auth_unit())
        ))
    );

CREATE POLICY "Users insert own attendance" ON public.attendance_events
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
    );

-- --- TASKS POLICIES ---
CREATE POLICY "Users view assigned tasks" ON public.tasks
    FOR SELECT TO authenticated USING (
        assigned_to = auth.uid() OR
        assigned_by = auth.uid() OR
        public.is_admin()
    );

CREATE POLICY "Admins insert tasks" ON public.tasks
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Authorized users update tasks" ON public.tasks
    FOR UPDATE TO authenticated USING (
        assigned_to = auth.uid() OR
        assigned_by = auth.uid() OR
        public.is_admin()
    );

-- --- TASK STATUS HISTORY POLICIES ---
CREATE POLICY "View task history" ON public.task_status_history
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = public.task_status_history.task_id 
              AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Insert task history" ON public.task_status_history
    FOR INSERT TO authenticated WITH CHECK (
        changed_by = auth.uid() OR public.is_admin()
    );

-- --- EVENTS POLICIES ---
CREATE POLICY "View events" ON public.events
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage events" ON public.events
    FOR ALL TO authenticated USING (public.is_admin());

-- --- EVENT ASSIGNMENTS POLICIES ---
CREATE POLICY "View event assignments" ON public.event_assignments
    FOR SELECT TO authenticated USING (
        personnel_id = auth.uid() OR public.is_admin() OR public.is_commander()
    );

CREATE POLICY "Manage event assignments" ON public.event_assignments
    FOR ALL TO authenticated USING (public.is_admin());

-- --- NOTIFICATIONS POLICIES ---
CREATE POLICY "Users view and update own notifications" ON public.notifications
    FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System and Admins create notifications" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (true);

-- --- AUDIT LOGS POLICIES ---
CREATE POLICY "Only admins view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Authenticated users insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- --- APP SETTINGS POLICIES ---
CREATE POLICY "Settings viewable by authenticated" ON public.app_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins update settings" ON public.app_settings
    FOR ALL TO authenticated USING (public.is_admin());

-- ============================================================================
-- SECURITY TRIGGER: PREVENT PRIVILEGE ESCALATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If non-admin tries to change role, account_status, district_id, or unit_id
    IF NOT public.is_admin() THEN
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

DROP TRIGGER IF EXISTS trg_protect_profile_escalation ON public.profiles;
CREATE TRIGGER trg_protect_profile_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privilege_escalation();

-- ============================================================================
-- SEED DEFAULT SETTINGS & INITIAL DISTRICTS
-- ============================================================================
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('public_registration', '{"enabled": true, "default_role": "home_guard", "require_approval": true}'::jsonb, 'Public signup settings for Home Guard recruitment'),
    ('geofence_default_radius', '{"radius_meters": 150, "strict_mode": true}'::jsonb, 'Default geofence perimeter radius in meters'),
    ('system_branding', '{"name": "Tamil Nadu Home Guards Supervision System", "agency": "Home Guards & Civil Defence Tamil Nadu", "helpline": "044-28447700"}'::jsonb, 'Branding details')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.districts (name, code, headquarters)
VALUES 
    ('Chennai Greater City', 'CHN', 'Commissioner of Police HQ, Vepery, Chennai'),
    ('Coimbatore City', 'CBE', 'Coimbatore City Police Office, Coimbatore'),
    ('Madurai City', 'MDU', 'Madurai City Police Office, Alagar Kovil Rd, Madurai'),
    ('Tiruchirappalli City', 'TRY', 'Trichy City Police Office, Cantonment, Trichy'),
    ('Salem City', 'SLM', 'Salem City Police Office, Linemedu, Salem'),
    ('Tirunelveli City', 'TNV', 'Tirunelveli City Police Office, Palayamkottai'),
    ('Chengalpattu District', 'CPT', 'District Police Office, Chengalpattu'),
    ('Kanchipuram District', 'KCH', 'District Police Office, Kanchipuram'),
    ('Vellore District', 'VEL', 'District Police Office, Vellore'),
    ('Thanjavur District', 'TNJ', 'District Police Office, Thanjavur')
ON CONFLICT (code) DO NOTHING;

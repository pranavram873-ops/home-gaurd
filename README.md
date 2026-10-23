# TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
### Government of Tamil Nadu — Police Department Auxiliary & Field Operations Platform

An enterprise-grade, full-stack operational supervision platform designed specifically for the **Tamil Nadu Home Guards & Civil Defence**. It delivers role-based dashboards, GPS-geofenced biometric attendance verification using the Haversine algorithm, platoon bandobast duty scheduling, supervisory Kanban task boards, major event coordination, and tamper-resistant audit logs.

---

## 1. ARCHITECTURE & TECHNOLOGY STACK

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & Design System:** Tailwind CSS v4, Inter Typography, Official Tamil Nadu Home Guards Emblem & Palette (Navy Blue `#002b7f`, Royal Blue `#0037b0`, Laurel Green `#006b2f`, Crimson Red `#ba1a1a`)
- **Icons:** Lucide React
- **Backend & APIs:** Route handlers only where a browser cannot go — `/api/attendance/check-in` (server-side geofence calculation) and `/api/admin/personnel` (creating a login, which RLS cannot express)
- **Database:** Supabase PostgreSQL with 14 relational tables, foreign key constraints, indexes, and comprehensive Row Level Security (RLS) policies
- **Data access:** every screen reads and writes the database through the browser Supabase client, so RLS decides what an account may see. There is no sample or in-memory data anywhere in the application.
- **Authentication:** Supabase Auth (SSR session cookies) & Role-Based Access Control (RBAC)
- **Geofencing:** Server-validated Haversine formula calculation verifying coordinates against circular perimeters (150m - 250m)
- **Validation:** Zod schemas
- **Deployment:** Vercel ready

---

## 2. REPOSITORY FILE STRUCTURE

```
home-guard-supervision/
├── public/
│   ├── images/
│   │   └── tn-home-guards-logo.png       # Official Tamil Nadu Home Guards emblem
│   └── logo.png
├── scripts/
│   ├── bootstrap-admin.mjs               # Secure first administrator setup script
│   ├── check-supabase.mjs                # Read-only connectivity / schema probe
│   └── run-tests.mjs                     # Automated security & business rules test runner
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Redirects to /login; there is no public landing page
│   │   ├── login/page.tsx                # Supabase password sign-in with show/hide password
│   │   ├── register/page.tsx             # Volunteer enrolment (enforces 'pending' status)
│   │   ├── forgot-password/page.tsx      # Password recovery dispatch
│   │   ├── reset-password/page.tsx       # Secure password reset
│   │   ├── admin/
│   │   │   ├── dashboard/page.tsx        # State Headquarters command overview
│   │   │   ├── personnel/page.tsx        # Statewide personnel roster, filters & CSV export
│   │   │   ├── approvals/page.tsx        # Recruit enrolment approval / rejection desk
│   │   │   ├── assignments/page.tsx      # Bandobast shift deployment & duty creator
│   │   │   ├── locations/page.tsx        # Geofenced sector posts & perimeter visualizer
│   │   │   ├── tasks/page.tsx            # Supervision Kanban board (New, Assigned, In Flight, Done)
│   │   │   ├── events/page.tsx           # Major operations planner (VIP route, festival bandobast)
│   │   │   ├── reports/page.tsx          # Muster analytics, compliance rate & CSV export
│   │   ├── homeguard/
│   │   │   ├── dashboard/page.tsx        # Personalized guard duty portal
│   │   │   ├── location/page.tsx         # GPS & Biometric geofenced check-in / check-out
│   │   │   ├── duties/page.tsx           # Duty schedule & shift details
│   │   │   ├── tasks/page.tsx            # Assigned directives with progress toggle
│   │   │   ├── attendance/page.tsx       # Personal attendance history
│   │   │   ├── reports/page.tsx          # Personnel report desk (shared component)
│   │   │   └── profile/page.tsx          # Permitted contact dossier updates
│   │   ├── api/
│   │   │   ├── admin/personnel/route.ts  # Server-only staff enrolment; mints the Auth login
│   │   │   └── attendance/check-in/route.ts # Coordinate validation & muster stamp API
│   │   ├── layout.tsx                    # Root layout with AuthProvider & Inter font
│   │   └── globals.css                   # Theme definitions & beacon pulse animations
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx                # Fixed top bar with live calendar date & notifications
│   │   │   ├── Sidebar.tsx               # Persistent left navigation with official emblem
│   │   │   └── DashboardLayout.tsx       # Responsive layout shell
│   │   └── reports/
│   │       └── ComplaintCenter.tsx       # Report submission, review and response workflow
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── authContext.tsx           # Supabase session, sign-in/out, profile state
│   │   │   └── errors.ts                 # Supabase Auth errors as departmental messages
│   │   ├── hooks/
│   │   │   └── useLiveQuery.ts           # Loading, error and refresh state for a database screen
│   │   ├── services/
│   │   │   ├── queryError.ts             # Postgres / PostgREST codes as readable messages
│   │   │   ├── selects.ts                # The verified column lists every service shares
│   │   │   ├── referenceService.ts       # Districts, units, duty posts
│   │   │   ├── personnelService.ts       # Roster reads, own-profile updates, staff enrolment
│   │   │   ├── assignmentService.ts      # Duty rosters
│   │   │   ├── attendanceService.ts      # Muster stamps
│   │   │   ├── taskService.ts            # Tasks and their status history
│   │   │   ├── eventService.ts           # Events and event deployments
│   │   │   ├── notificationService.ts    # Header bell
│   │   │   ├── auditService.ts           # Audit trail writes and reads
│   │   │   ├── enrolmentService.ts       # Approvals desk queue and decisions
│   │   │   ├── statsService.ts           # Dashboard head counts and activity panels
│   │   │   └── reportService.ts          # Row set behind the Reports desk
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser Supabase client (@supabase/ssr)
│   │   │   ├── server.ts                 # Server-side Supabase client with Next.js cookies
│   │   │   ├── admin.ts                  # Privileged server-only client
│   │   │   └── middleware.ts             # Session refresh & route guard helper
│   │   ├── validation/
│   │   │   └── index.ts                  # Zod validation schemas
│   │   └── utils.ts                      # Haversine distance calculator & formatters
│   ├── middleware.ts                     # Next.js route protection middleware
│   └── types/
│       └── index.ts                      # Domain TypeScript interfaces
└── supabase/
    └── migrations/
        ├── 20261019000000_initial_schema.sql  # 13 relational tables, indexes, RLS & escalation triggers
        ├── 20261019000001_seed_units_and_mock_personnel.sql # District units & real duty posts (reference data)
        ├── 20261021000000_enrolment_hook_and_commander_role.sql # Profile row on signup
        ├── 20261022000000_guard_reports.sql # Guard reports, admin review, scoped RLS
        ├── 20261023000000_remove_commander_role.sql # Retires the Area Commander role
        └── 20261024000000_personnel_badge.sql # Issues the service badge when an account is activated
```

---

## 3. SIGN-IN, SESSIONS AND ROLE REDIRECTION

Sign-in is real Supabase Auth (`signInWithPassword`) against `auth.users`; the
personnel row in `public.profiles` decides the role and the redirect, and the
session travels in SSR cookies refreshed by `src/middleware.ts` on each request.

There are **no built-in logins**. Every operational account must exist in
Supabase Auth with an `active` profile row. Create the first administrator with
the bootstrap script in section 5, then promote or activate volunteers from the
approvals desk or with **Add Personnel**.

**Every screen behind the sign-in is database-backed.** The two dashboards,
personnel roster, duty posts, bandobast board, task board, event planner,
approvals desk, reports, the guard's own duty / task / attendance / profile
screens and the personnel report desk all query Supabase through the browser
client, so Row Level Security decides what the signed-in account can read or
change. There is no demo mode and no in-memory fixture left to remove. A freshly
provisioned project therefore shows reference data only — districts, units and
duty posts — and every operational list is honestly empty until records exist.

| Role | Authorized Dashboard | Notes |
|---|---|---|
| **State Administrator** | `/admin/dashboard` | Only role allowed on `/admin/*` |
| **Home Guard Volunteer** | `/homeguard/dashboard` | Restricted to personal duty, tasks and GPS check-in |
| **Pending / suspended** | blocked | Redirected to `/login` with the reason shown |

Sign-in failures are reported per cause: wrong credentials, e-mail not
confirmed, no profile row, pending approval, suspended account, rate limiting.

> **No demo mode.** The application has no flag that bypasses authentication
> and no sample personnel to sign in as. If a screen looks empty, it is because
> the table beneath it is empty, not because data was withheld.

### Role Authorization Rules
- **Home Guards:** Exclusively restricted to their personal dashboard, assigned duty, tasks, and GPS check-in. Attempting to navigate to `/admin/*` is automatically redirected.
- **Administrators:** Full statewide oversight across all 38 districts, registration approval authority, and geofence post configuration.
- **Pending Recruits:** If an applicant submits enrolment via `/register`, a `profiles` row is created by the database trigger with role `home_guard` and status `pending`. It waits in the administrator's approvals desk directly — there is no Area Command step. `/admin/approvals` reads and writes that live `profiles` table (visible and editable only to an administrator under RLS), so **Verify & Approve** sets `account_status = 'active'` in the database itself. The applicant must also confirm their e-mail before Supabase Auth will issue a session.

### Adding Personnel from the administrator desk

Volunteers enrol themselves; **Add Personnel** on `/admin/personnel` covers the
other case — a transfer posting, a direct appointment, an officer who never
submitted the public form. Creating a *login* is the one operation RLS cannot
express (`profiles` allows an insert only where `auth.uid() = id`), so the form
posts to `/api/admin/personnel`, the only place in the application that reads the
secret key:

1. The route verifies the caller with the cookie-bound session client
   (`auth.getUser()`) and then asks the database `rpc('is_admin')`. No session is
   `401`, a signed-in non-administrator is `403`, and a failed authority check is
   `503` — the account is never created on a guess.
2. The chosen district and unit ids are resolved to their `code` values first, so
   the signup trigger can act on them and a stale id is rejected before any Auth
   user exists.
3. `auth.admin.createUser({ email_confirm: true, user_metadata })` mints the
   login. `handle_new_user` writes the `pending` `home_guard` profile row from
   that metadata. An address already on the roster returns `409`.
4. The route updates that row by id with the selected role, district, unit, rank
   and `account_status = 'active'`, or inserts it if the trigger has not been
   installed. If the profile write fails, the Auth user is deleted again rather
   than left signing in to a blank dossier.
5. An `audit_logs` row (`CREATE_STAFF_ACCOUNT`) names the acting administrator and
   the new officer, and the response returns a generated temporary password
   **once** for the operator to hand over. It is not stored anywhere; the officer
   is expected to set their own through the forgot-password flow.

The `assign_personnel_badge` trigger issues the service badge number as the row
becomes active, whether the account was approved at the approvals desk or created
here, so `personnel_id` collisions stay inside the database's `UNIQUE` check.

---

## 4. GEOFENCED BIOMETRIC ATTENDANCE (HAVERSINE ALGORITHM)

When a Home Guard clicks **Proceed to GPS Check-In** on `/homeguard/location`:
1. The browser requests high-accuracy GPS coordinates (`enableHighAccuracy: true`).
2. The coordinates are sent to the server-side validator (`/api/attendance/check-in`).
3. The server runs the Haversine formula against the authorized duty post:
   $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
4. If $d \le \text{radius}$ (e.g. 250m for Marina Beach Post), the muster stamp is marked `verified`.
5. If $d > \text{radius}$, the stamp is flagged with the exact excess distance.
6. A 15-minute debounce check blocks consecutive duplicate stamps.

---

## 5. FIRST ADMINISTRATOR BOOTSTRAPPING PROCEDURE

To provision the initial State Administrator without exposing credentials:

1. Configure live Supabase credentials in `.env.local`. With the Vercel
   Marketplace integration, pull them instead of pasting keys:
   ```bash
   npx vercel link
   npx vercel env pull .env.local
   ```
   The script reads `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and the
   server-only secret `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).
   Never put the secret key in a `NEXT_PUBLIC_*` variable.

2. Execute the bootstrap script in an interactive PowerShell terminal. It prompts
   for the password without echoing it, so the password is not part of the
   command or shell history:
   ```bash
   node scripts/bootstrap-admin.mjs <admin-email> "<full-name>"
   ```

   **Example:**
   ```bash
   node scripts/bootstrap-admin.mjs admin@your-organization.example "Your Name"
   ```

3. The script:
   - Creates the Supabase Auth user with email pre-confirmed.
   - Upserts the record into `public.profiles` with `role = 'admin'` and `account_status = 'active'`.
   - Does not invent a phone number, personnel number, or district assignment.
   - If the Auth user already exists, it keeps that account's current password.

---

## 6. SUPABASE & GOOGLE MAPS CONFIGURATION

### Supabase Database Setup
1. Provision Supabase through the Vercel Marketplace (or at [supabase.com](https://supabase.com)).
2. For a **new, empty project only**, open the Supabase SQL Editor and apply
   each migration once, in timestamp order. The first creates the schema,
   indexes, RLS policies and the escalation trigger; the second seeds the
   district **units** and the real **duty posts** (reference data — it inserts no
   personnel, no duties and no attendance); the third adds the signup trigger;
   the fourth adds personnel reports; the fifth retires the Area Commander role;
   the sixth issues the service badge when an account is activated. Do not
   re-run these files on a project whose schema is already present. Apply only
   missing migrations, in timestamp order.
3. For the currently connected project, first run the read-only connectivity
   check below. If it reports all 14 tables, do not apply the first file again.
   The seed inserts duty posts without an `ON CONFLICT` clause, so run
   `20261019000001_seed_units_and_mock_personnel.sql` **exactly once**, and only
   while `units` and `duty_locations` are empty. Check whether
   `public.handle_new_user()` and the `on_auth_user_created` trigger exist; if
   they do not, apply the enrolment migration. Apply
   `20261022000000_guard_reports.sql` once to enable the report workflow,
   `20261023000000_remove_commander_role.sql` once to drop the commander role,
   its `is_commander()` helper and its policy clauses, and
   `20261024000000_personnel_badge.sql` once so an approved or enrolled account
   receives a badge number. Apply each file once; only the badge migration is
   written to be safe to repeat (`CREATE OR REPLACE` plus
   `DROP TRIGGER IF EXISTS`).
4. Verify from the terminal (read-only, prints no secrets):
   ```bash
   npm run check:supabase
   ```
   If a table exists but PostgREST cannot find it, reload the API schema from
   SQL Editor with `NOTIFY pgrst, 'reload schema';`.

### Supabase Auth Setup
1. **Authentication → Providers → Email** stays enabled; confirmation e-mail is
   on, so a new volunteer must click the link in that e-mail before signing in.
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` locally, the Vercel domain in
     production (this is also `NEXT_PUBLIC_APP_URL`).
   - **Redirect URLs**: add `<site URL>/login?notice=email_confirmed` and
     `<site URL>/reset-password`.
3. Create the first administrator (section 5). Public enrolment can never
   produce an administrator: the role is fixed inside the database trigger.

### Google Maps Setup (Optional)
1. In Google Cloud Console, enable **Maps JavaScript API**, **Places API**, and **Geocoding API**.
2. Add your key to `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```
   *(If omitted, the application uses its built-in interactive SVG perimeter map with zero external dependencies.)*

---

## 7. LOCAL DEVELOPMENT & VERIFICATION COMMANDS

### Install Dependencies
```bash
npm install
```

### Run Automated Security & Rule Tests
```bash
node scripts/run-tests.mjs
```
*(Executes 15 automated test assertions covering geofencing, privilege escalation prevention, account status gates, role redirects, and duplicate attendance prevention.)*

### Run Next.js Production Build
```bash
npm run build
```

### Start Development Server
```bash
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. DEPLOYMENT TO VERCEL

1. Push this repository to GitHub or GitLab.
2. In the Vercel dashboard, click **Add New Project** and select this repository.
3. Configure Environment Variables in Vercel for Production (and Preview, if
   needed). The Marketplace Supabase integration may supply server-side names;
   `next.config.ts` maps the URL and publishable/anon key to browser-readable
   names during the build. If you configure them manually, use:
   - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_ANON_KEY`)
   - `SUPABASE_SECRET_KEY` (server-only; never a `NEXT_PUBLIC_*` name)
   - `NEXT_PUBLIC_APP_URL` — the deployed origin, used for recovery e-mails
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION=true`
4. Click **Deploy**. Next.js will automatically compile all static and dynamic routes.
"# home-gaurd" 
"# home-gaurd" 

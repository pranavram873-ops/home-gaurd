# TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
### Government of Tamil Nadu — Police Department Auxiliary & Field Operations Platform

An enterprise-grade, full-stack operational supervision platform designed specifically for the **Tamil Nadu Home Guards & Civil Defence**. It delivers role-based dashboards, GPS-geofenced biometric attendance verification using the Haversine algorithm, platoon bandobast duty scheduling, supervisory Kanban task boards, major event coordination, and tamper-resistant audit logs.

---

## 1. ARCHITECTURE & TECHNOLOGY STACK

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling & Design System:** Tailwind CSS v4, Inter Typography, Official Tamil Nadu Home Guards Emblem & Palette (Navy Blue `#002b7f`, Royal Blue `#0037b0`, Laurel Green `#006b2f`, Crimson Red `#ba1a1a`)
- **Icons:** Lucide React
- **Backend & APIs:** Next.js Server Components, Server Actions & Route Handlers (`/api/attendance/check-in`)
- **Database:** Supabase PostgreSQL with 13 relational tables, foreign key constraints, indexes, and comprehensive Row Level Security (RLS) policies
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
│   │   ├── page.tsx                      # Public landing page with government branding
│   │   ├── login/page.tsx                # Role-based login with show/hide password & quick demo access
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
│   │   │   └── audit/page.tsx            # Immutable security & administrative access logs
│   │   ├── homeguard/
│   │   │   ├── dashboard/page.tsx        # Personalized guard duty portal
│   │   │   ├── location/page.tsx         # GPS & Biometric geofenced check-in / check-out
│   │   │   ├── duties/page.tsx           # Duty schedule & shift details
│   │   │   ├── tasks/page.tsx            # Assigned directives with progress toggle
│   │   │   ├── attendance/page.tsx       # Personal attendance history
│   │   │   └── profile/page.tsx          # Permitted contact dossier updates
│   │   ├── api/
│   │   │   └── attendance/check-in/      # Coordinate validation & attendance stamp API
│   │   ├── layout.tsx                    # Root layout with AuthProvider & Inter font
│   │   └── globals.css                   # Theme definitions & beacon pulse animations
│   ├── components/
│   │   └── layout/
│   │       ├── Header.tsx                # Fixed top bar with live calendar date & notifications
│   │       ├── Sidebar.tsx               # Persistent left navigation with official emblem
│   │       └── DashboardLayout.tsx       # Responsive layout shell
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── authContext.tsx           # Supabase session, sign-in/out, profile state
│   │   │   └── errors.ts                 # Supabase Auth errors as departmental messages
│   │   ├── services/
│   │   │   └── dataService.ts            # Data operations layer with realistic Tamil Nadu seed data
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
        ├── 20261019000001_seed_units_and_mock_personnel.sql # Real TN posts (Marina, Central, Meenakshi)
        ├── 20261021000000_enrolment_hook_and_commander_role.sql # Profile row on signup
        ├── 20261022000000_guard_reports.sql # Guard reports, admin review, scoped RLS
        └── 20261023000000_remove_commander_role.sql # Retires the Area Commander role
```

---

## 3. SIGN-IN, SESSIONS AND ROLE REDIRECTION

Sign-in is real Supabase Auth (`signInWithPassword`) against `auth.users`; the
personnel row in `public.profiles` decides the role and the redirect, and the
session travels in SSR cookies refreshed by `src/middleware.ts` on each request.

There are **no built-in logins**. Every operational account must exist in
Supabase Auth with an `active` profile row. Create the first administrator with
the bootstrap script in section 5, then promote or activate volunteers from the
approvals desk.

| Role | Authorized Dashboard | Notes |
|---|---|---|
| **State Administrator** | `/admin/dashboard` | Only role allowed on `/admin/*` |
| **Home Guard Volunteer** | `/homeguard/dashboard` | Restricted to personal duty, tasks and GPS check-in |
| **Pending / suspended** | blocked | Redirected to `/login` with the reason shown |

Sign-in failures are reported per cause: wrong credentials, e-mail not
confirmed, no profile row, pending approval, suspended account, rate limiting.

> **Demo mode (not authentication):** set `NEXT_PUBLIC_DEMO_MODE=true` outside a
> production build to sign in from in-memory sample personnel. It adds a
> "DEMO DATA" badge to the header and login screen, and a production build
> ignores the flag entirely, so a demo can never be mistaken for a real session.

### Role Authorization Rules
- **Home Guards:** Exclusively restricted to their personal dashboard, assigned duty, tasks, and GPS check-in. Attempting to navigate to `/admin/*` is automatically redirected.
- **Administrators:** Full statewide oversight across all 38 districts, registration approval authority, and geofence post configuration.
- **Pending Recruits:** If an applicant submits enrolment via `/register`, a `profiles` row is created by the database trigger with role `home_guard` and status `pending`. It waits in the administrator's approvals desk directly — there is no Area Command step. They must confirm their e-mail and be approved before operational access is granted.

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
   each migration once, in timestamp order. The first migration creates the
   schema and the audit table; the second adds sample locations and units; the
   third adds the signup trigger; the fourth adds personnel reports; the fifth
   retires the Area Commander role. Do not re-run these files on a project whose
   schema is already present. Apply only missing migrations, in timestamp order.
3. For the currently connected project, first run the read-only connectivity
   check below. If it reports all 14 tables, do not apply the first two files
   again. Check whether `public.handle_new_user()` and the
   `on_auth_user_created` trigger exist; if they do not, apply the enrolment
   migration. Apply `20261022000000_guard_reports.sql` once to enable the
   report workflow, and `20261023000000_remove_commander_role.sql` once to drop
   the commander role, its `is_commander()` helper and its policy clauses.
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
   - `NEXT_PUBLIC_DEMO_MODE` — omit it, or leave it `false`; a production build
     ignores it either way
4. Click **Deploy**. Next.js will automatically compile all 32 static and dynamic routes.
"# home-gaurd" 
"# home-gaurd" 

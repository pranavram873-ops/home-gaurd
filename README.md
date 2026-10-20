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
│   │   ├── commander/
│   │   │   ├── dashboard/page.tsx        # Area Command overview (Zone IV Mylapore Sector)
│   │   │   ├── personnel/page.tsx        # Unit personnel roster
│   │   │   ├── assignments/page.tsx      # Unit duty rosters
│   │   │   ├── locations/page.tsx        # Unit sector posts
│   │   │   ├── tasks/page.tsx            # Unit supervisory tasks
│   │   │   ├── events/page.tsx           # Unit event allocations
│   │   │   └── reports/page.tsx          # Unit compliance reports
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
│   │   │   └── authContext.tsx           # Authentication & role switching context
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
        └── 20261019000001_seed_units_and_mock_personnel.sql # Real TN posts (Marina, Central, Meenakshi)
```

---

## 3. HOW EACH ROLE LOGS IN & DASHBOARD REDIRECTION

The system provides role-based redirection verified on both client and server:

| Role | Test Account Email | Default Password | Badge ID | Authorized Dashboard |
|---|---|---|---|---|
| **State Administrator** | `admin@tnhomeguards.gov.in` | `Police@TN2024` | `TNHG-HQ-001` | `/admin/dashboard` |
| **Area Commander** | `commander@tnhomeguards.gov.in` | `Police@TN2024` | `TN-HG-44029` | `/commander/dashboard` |
| **Home Guard Volunteer** | `homeguard@tnhomeguards.gov.in` | `Police@TN2024` | `TN-HG-52914` | `/homeguard/dashboard` |

> **Evaluation Shortcut:** The `/login` page features a **One-Click Fast-Track** panel allowing evaluators to immediately log in as any role without manual typing.

### Role Authorization Rules
- **Home Guards:** Exclusively restricted to their personal dashboard, assigned duty, tasks, and GPS check-in. Attempting to navigate to `/admin/*` or `/commander/*` is automatically redirected.
- **Commanders:** Scoped strictly to their assigned district and unit (`Zone IV - Mylapore Division`). Cannot alter system settings or access unrelated district resources.
- **Administrators:** Full statewide oversight across all 38 districts, registration approval authority, and geofence post configuration.
- **Pending Recruits:** If an applicant submits registration via `/register`, their account remains in `pending` status. Logging in before administrator verification displays a status notice and blocks operational access.

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

1. Configure your live Supabase credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
   ```

2. Execute the bootstrap script via CLI:
   ```bash
   node scripts/bootstrap-admin.mjs <admin-email> <password> "<full-name>"
   ```

   **Example:**
   ```bash
   node scripts/bootstrap-admin.mjs state.commandant@tnhomeguards.gov.in Police@TN2024 "Dr. K. Vijayakumar, IPS"
   ```

3. The script:
   - Creates the Supabase Auth user with email pre-confirmed.
   - Upserts the record into `public.profiles` with `role = 'admin'` and `account_status = 'active'`.
   - Assigns official State Commandant badge `TNHG-HQ-001`.
   - Records an immutable audit log entry.

---

## 6. SUPABASE & GOOGLE MAPS CONFIGURATION

### Supabase Database Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. Run `supabase/migrations/20261019000000_initial_schema.sql` to generate all 13 tables, RLS policies, and privilege protection triggers.
4. Run `supabase/migrations/20261019000001_seed_units_and_mock_personnel.sql` to populate initial districts (Chennai, Coimbatore, Madurai, Salem, etc.) and geofenced posts.
5. In **Authentication -> URL Configuration**, set the Site URL to `http://localhost:3000` (or your Vercel deployment URL).

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
3. Configure Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION=true`
4. Click **Deploy**. Next.js will automatically compile all 32 static and dynamic routes.
"# home-gaurd" 

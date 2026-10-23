// Read-only connectivity probe for the Vercel-managed Supabase project.
// Usage:  node scripts/check-supabase.mjs
// (Loads .env.local automatically via `node --env-file`; no secrets are printed.)
//
// Also usable as: npm run check:supabase

import { createClient } from '@supabase/supabase-js';

// Same resolution order as src/lib/supabase/env.ts, so the probe exercises the
// exact credential the application uses rather than a leftover legacy key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const TABLES = [
  'districts', 'units', 'profiles', 'duty_locations', 'duty_assignments',
  'attendance_events', 'tasks', 'task_status_history', 'events',
  'event_assignments', 'notifications', 'audit_logs', 'app_settings',
  'guard_reports',
];

// Tables that revoke anonymous access deliberately. Postgres answers the
// keyless probe with "permission denied", which proves the table exists *and*
// is locked down — a pass, not a problem.
const ANON_DENIED = new Set(['guard_reports']);

// Functions the API must expose. Two failure modes look identical through REST
// but mean opposite things, so each entry declares what a correct answer is:
//   'value'  — an anonymous caller must get a result back (RLS policy helpers)
//   'exists' — the function must be in the schema cache; refusing an anonymous
//              caller is the intended behaviour and counts as a pass
const RPCS = [
  { name: 'is_admin', expects: 'value' },
  { name: 'list_reportable_home_guards', expects: 'exists' },
];

function mask(v) {
  if (!v) return '(missing)';
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

console.log('TN Home Guards — Supabase connectivity probe');
console.log(`  SUPABASE_URL ........ ${url || '(missing)'}`);
console.log(`  publishable key ..... ${mask(key)}  (value not shown in full)`);

if (!url || !key) {
  console.error('\n✗ Environment variables not found. Run `vercel link` then `vercel env pull .env.local`.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. Reachability + key validity (RLS applies for the anon key).
//    NOTE: these are GET queries on purpose. A HEAD request (`head: true`) has
//    no body, so PostgREST errors such as PGRST205 "not in the schema cache"
//    come back with no error object and would be misread as success.
const ping = await sb.from('districts').select('id', { count: 'exact' }).limit(1);
if (ping.error && (ping.code === '42P01' || ping.code === 'PGRST205')) {
  console.log('\n✓ Project reachable and key valid, but the schema is not exposed to the API yet.');
  console.log('→ Apply the migrations from supabase/migrations/ in the Supabase SQL Editor (or `supabase db push`),');
  console.log('  then run `NOTIFY pgrst, \'reload schema\';` if the tables were created out of band.');
  process.exit(2);
}
if (ping.error && /relation|schema/i.test(ping.error.message)) {
  console.log(`\n✓ Project reachable (schema not applied yet: ${ping.error.message})`);
  process.exit(2);
}
if (ping.error) {
  console.error(`\n✗ Probe query failed: [${ping.code || 'n/a'}] ${ping.error.message}`);
  if (/invalid|jwt|apikey/i.test(ping.error.message)) {
    console.error('→ The publishable key does not match this project. Re-run `vercel env pull .env.local`.');
  }
  process.exit(1);
}

console.log(`\n✓ REST endpoint reachable and key valid (RLS enforced).`);
console.log(`  districts returned for this role: ${ping.data?.length ?? 0} row(s) (RLS may hide all of them)\n`);

// 2. Which expected tables are reachable through the API? `select('*')` is used
//    because not every table has an `id` column (app_settings is keyed by `key`).
const missing = [];
for (const t of TABLES) {
  const res = await sb.from(t).select('*').limit(1);
  if (res.error) {
    if (
      ANON_DENIED.has(t) &&
      (res.error.code === '42501' || /permission denied/i.test(res.error.message ?? ''))
    ) {
      console.log(`  ✓ ${t.padEnd(20)} present and anonymous access denied (by design)`);
      continue;
    }
    const note =
      res.error.code === '42P01' || res.error.code === 'PGRST205'
        ? 'not in the PostgREST schema cache — apply the migrations, then reload the schema'
        : res.error.message;
    missing.push(`${t}  [${res.error.code || 'n/a'}] ${note}`);
  } else {
    console.log(`  ✓ ${t.padEnd(20)} queryable (rows visible to this role: ${res.data?.length ?? 0}+ / capped by limit)`);
  }
}

// 3. Functions behind the RLS policies and the reports screen. A table can be
//    queryable while its policy helper is missing, which only breaks things for
//    signed-in users — so it has to be probed separately.
console.log('\nDatabase functions referenced by the application:');
const rpcProblems = [];
for (const { name, expects } of RPCS) {
  const res = await sb.rpc(name);
  const absent =
    res.error &&
    (res.error.code === 'PGRST202' || /could not find the function/i.test(res.error.message ?? ''));

  if (!res.error) {
    console.log(`  ✓ ${name.padEnd(30)} callable, returned ${JSON.stringify(res.data ?? null)}`);
  } else if (absent) {
    rpcProblems.push(
      `${name}  [PGRST202] not in the PostgREST schema cache — apply the migrations, then reload the schema`,
    );
  } else if (expects === 'exists') {
    console.log(
      `  ✓ ${name.padEnd(30)} present; refused an anonymous caller as designed ` +
        `(${(res.error.message || '').split('\n')[0].slice(0, 64)})`,
    );
  } else {
    rpcProblems.push(`${name}  [${res.error.code || 'n/a'}] ${res.error.message}`);
  }
}

if (missing.length || rpcProblems.length) {
  console.log('\n✗ Problems:');
  [...missing, ...rpcProblems].forEach((m) => console.log(`  - ${m}`));
  process.exit(2);
}

console.log(`\n✓ All ${TABLES.length} expected tables and ${RPCS.length} expected functions are exposed to the API.`);
console.log('  This probe does not verify Auth users, the signup trigger, profile rows, or end-to-end app workflows.');

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

// 2. Which expected tables are queryable through the API? (RLS may hide rows.)
const missing = [];
for (const t of TABLES) {
  const res = await sb.from(t).select('id').limit(1);
  if (res.error) {
    const note =
      res.error.code === '42P01' || res.error.code === 'PGRST205'
        ? 'not in the PostgREST schema cache — apply the migrations, then reload the schema'
        : res.error.message;
    missing.push(`${t}  [${res.error.code || 'n/a'}] ${note}`);
  } else {
    console.log(`  ✓ ${t.padEnd(20)} queryable (rows visible to this role: ${res.data?.length ?? 0}+ / capped by limit)`);
  }
}

if (missing.length) {
  console.log('\n✗ Problems:');
  missing.forEach((m) => console.log(`  - ${m}`));
  process.exit(2);
}

console.log('\n✓ All 13 expected tables are queryable with this key.');
console.log('  This probe does not verify Auth users, the signup trigger, profile rows, or end-to-end app workflows.');

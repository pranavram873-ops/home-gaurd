// Read-only connectivity probe for the Vercel-managed Supabase project.
// Usage:  node scripts/check-supabase.mjs
// (Loads .env.local automatically via `node --env-file`; no secrets are printed.)
//
// Also usable as: npm run check:supabase

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
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
const ping = await sb.from('districts').select('id', { count: 'exact', head: true });
if (ping.error && ping.code === '42P01') {
  console.log('\n✓ Project reachable and key valid, but tables are missing.');
  console.log('→ Apply the migrations from supabase/migrations/ in the Supabase SQL Editor (or `supabase db push`).');
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
console.log(`  districts visible with current role: ${ping.count ?? 0} row(s)\n`);

// 2. Which expected tables exist? (head-count per table; RLS may hide rows.)
const missing = [];
for (const t of TABLES) {
  const res = await sb.from(t).select('id', { count: 'exact', head: true });
  if (res.error) {
    missing.push(`${t}  (${res.error.code === '42P01' ? 'table missing' : res.error.message})`);
  } else {
    console.log(`  ✓ ${t.padEnd(20)} visible rows: ${res.count ?? 0}`);
  }
}

if (missing.length) {
  console.log('\n✗ Problems:');
  missing.forEach((m) => console.log(`  - ${m}`));
  process.exit(2);
}

console.log('\n✓ All 13 expected tables are present. Application is ready for incremental feature wiring.');

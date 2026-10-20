/**
 * TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
 * Secure First Administrator Bootstrap Script
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs <admin-email> <admin-password> "<full-name>"
 *
 * Example:
 *   node scripts/bootstrap-admin.mjs state.commandant@tnhomeguards.gov.in SecureP@ssw0rd2024 "Dr. K. Vijayakumar, IPS"
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local or .env
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('dummy')) {
  console.error('\x1b[31m[ERROR]\x1b[0m Missing or dummy SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in .env.local');
  console.log('Please configure your live Supabase credentials before running this bootstrap script.');
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];
const fullName = process.argv[4] || 'State Commandant';

if (!email || !password) {
  console.log('\x1b[33mUsage:\x1b[0m node scripts/bootstrap-admin.mjs <email> <password> ["<full-name>"]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function bootstrap() {
  console.log(`\n\x1b[34m[TAMIL NADU HOME GUARDS SUPERVISION SYSTEM]\x1b[0m`);
  console.log(`Bootstrapping First State Administrator: ${email}...`);

  // 1. Create or retrieve auth user
  const { data: userAuth, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'admin' },
  });

  let userId = userAuth?.user?.id;

  if (authErr) {
    if (authErr.message.includes('already exists') || authErr.status === 422) {
      console.log('Auth user already exists in Supabase. Retrieving existing record...');
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const found = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) throw new Error('Could not retrieve existing user');
      userId = found.id;
    } else {
      throw authErr;
    }
  }

  console.log(`Verified Auth User ID: ${userId}`);

  // 2. Fetch Chennai district ID if exists
  const { data: district } = await supabase
    .from('districts')
    .select('id')
    .eq('code', 'CHN')
    .single();

  // 3. Upsert admin profile with active status and 'admin' role
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        phone: '9840011223',
        personnel_id: 'TNHG-HQ-001',
        role: 'admin',
        account_status: 'active',
        rank_designation: 'Director General of Police / State Commandant',
        district_id: district?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (profErr) throw profErr;

  console.log('\x1b[32m[SUCCESS]\x1b[0m First Administrator successfully provisioned:');
  console.log(`  Name: ${profile.full_name}`);
  console.log(`  Email: ${profile.email}`);
  console.log(`  Role: ${profile.role}`);
  console.log(`  Badge ID: ${profile.personnel_id}`);
  console.log(`  Status: ${profile.account_status}`);
  console.log('\nYou may now log in at /login with these credentials.\n');
}

bootstrap().catch((err) => {
  console.error('\x1b[31m[BOOTSTRAP FAILED]\x1b[0m', err.message || err);
  process.exit(1);
});

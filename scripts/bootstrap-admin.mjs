/**
 * TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
 * Secure First Administrator Bootstrap Script
 *
 * Usage (the password is entered without echo and is not saved in shell history):
 *   node scripts/bootstrap-admin.mjs <admin-email> "<full-name>"
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the local Vercel environment without requiring an extra dotenv package.
if (typeof process.loadEnvFile === 'function') {
  for (const envFile of [resolve(__dirname, '../.env.local'), resolve(__dirname, '../.env')]) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
}

// Prefer Vercel-managed Supabase integration names; fall back to legacy names.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('dummy')) {
  console.error('\x1b[31m[ERROR]\x1b[0m Missing or dummy SUPABASE_SECRET_KEY / SUPABASE_URL in .env.local');
  console.log('Configure the live Vercel-managed Supabase env vars first (vercel link && vercel env pull .env.local).');
  process.exit(1);
}

const email = process.argv[2]?.trim();
const fullName = process.argv[3]?.trim();

if (!email || !fullName) {
  console.log('\x1b[33mUsage:\x1b[0m node scripts/bootstrap-admin.mjs <email> "<full-name>"');
  process.exit(1);
}

function promptPassword() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this script in an interactive PowerShell terminal so the password can be entered securely.');
  }

  return new Promise((resolvePassword, rejectPassword) => {
    let password = '';
    const stdin = process.stdin;
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          rejectPassword(new Error('Admin setup cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolvePassword(password);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
          continue;
        }
        password += char;
      }
    };

    process.stdout.write('Admin password (input hidden): ');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function bootstrap() {
  const password = await promptPassword();
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');

  console.log(`\n\x1b[34m[TAMIL NADU HOME GUARDS SUPERVISION SYSTEM]\x1b[0m`);
  console.log(`Bootstrapping First State Administrator: ${email}...`);

  // 1. Create or retrieve auth user
  const { data: userAuth, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Role is deliberately omitted from untrusted user metadata. The database
    // trigger creates a pending home_guard profile; this server-only bootstrap
    // then promotes that profile using the secret key.
    user_metadata: { full_name: fullName },
  });

  let userId = userAuth?.user?.id;

  if (authErr) {
    if (authErr.message.includes('already exists') || authErr.status === 422) {
      console.log('Auth user already exists in Supabase. Retrieving existing record...');
      console.log('The existing account password will not be changed by this script.');
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

  // 2. Upsert the supplied administrator identity. Do not invent a phone,
  // personnel number, or district assignment during bootstrap.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        email,
        role: 'admin',
        account_status: 'active',
        rank_designation: 'State Administrator',
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
  console.log(`  Status: ${profile.account_status}`);
  console.log('\nYou may now log in at /login with these credentials.\n');
}

bootstrap().catch((err) => {
  console.error('\x1b[31m[BOOTSTRAP FAILED]\x1b[0m', err.message || err);
  process.exit(1);
});

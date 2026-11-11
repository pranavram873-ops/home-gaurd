/**
 * Create an active incharge login from an interactive terminal.
 *
 * Usage:
 *   node scripts/bootstrap-incharge.mjs <email> <username> "<full-name>"
 *
 * The email is used internally by Supabase Auth. The person signs in to the
 * application with the username and password entered here.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

if (typeof process.loadEnvFile === 'function') {
  for (const envFile of [resolve(scriptDir, '../.env.local'), resolve(scriptDir, '../.env')]) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey || secretKey.includes('dummy')) {
  console.error('\x1b[31m[ERROR]\x1b[0m Missing Supabase URL or secret/service-role key in .env.local.');
  console.log('Pull the project environment first with: vercel env pull .env.local');
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
const username = process.argv[3]?.trim().toUpperCase();
const fullName = process.argv[4]?.trim();

if (!email || !username || !fullName) {
  console.log('\x1b[33mUsage:\x1b[0m node scripts/bootstrap-incharge.mjs <email> <username> "<full-name>"');
  process.exit(1);
}

function promptHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this script in an interactive PowerShell terminal so the password is not echoed.');
  }

  return new Promise((resolveValue, reject) => {
    let value = '';
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
          reject(new Error('Incharge setup cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolveValue(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    process.stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function bootstrap() {
  const password = await promptHidden('Incharge password (input hidden): ');
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const confirmPassword = await promptHidden('Confirm password (input hidden): ');
  if (password !== confirmPassword) throw new Error('The passwords do not match. No account was created.');

  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('personnel_id', username)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existingProfile) throw new Error(`Username ${username} is already assigned to a profile.`);

  console.log(`\nCreating incharge login for ${fullName}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Supabase created no Auth user ID.');

  const profileData = {
    id: userId,
    full_name: fullName,
    email,
    personnel_id: username,
    role: 'incharge',
    account_status: 'active',
    rank_designation: 'Division Incharge',
    updated_at: new Date().toISOString(),
  };

  const { data: existingAuthProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileLookupError) {
    await supabase.auth.admin.deleteUser(userId);
    throw profileLookupError;
  }

  const profileWrite = existingAuthProfile
    ? await supabase.from('profiles').update(profileData).eq('id', userId)
    : await supabase.from('profiles').insert(profileData);

  if (profileWrite.error) {
    await supabase.auth.admin.deleteUser(userId);
    throw profileWrite.error;
  }

  console.log('\x1b[32m[SUCCESS]\x1b[0m Incharge login created:');
  console.log(`  Name: ${fullName}`);
  console.log(`  Username: ${username}`);
  console.log(`  Email: ${email}`);
  console.log('  Role: incharge');
  console.log('  Status: active');
  console.log('\nSign in at /login using the username and password you entered.');
}

bootstrap().catch((error) => {
  console.error('\x1b[31m[INCHARGE SETUP FAILED]\x1b[0m', error.message || error);
  process.exit(1);
});

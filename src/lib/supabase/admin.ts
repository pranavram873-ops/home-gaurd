import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

// Server-only privileged client. Uses the Vercel-managed integration's
// `SUPABASE_SECRET_KEY` (legacy names: `SUPABASE_SERVICE_KEY` /
// `SUPABASE_SERVICE_ROLE_KEY`). NEVER import this from browser code —
// the secret key bypasses Row Level Security.
export function getSupabaseSecretKey(): string {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  );
}

export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      'Supabase admin client requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). Pull them locally via `vercel env pull .env.local`.'
    );
  }

  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabasePublishableKey } from './env';

// Browser client: uses only the publishable (anon) key — RLS enforced.
export function createClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured. Run `vercel link` then `vercel env pull .env.local` to load the Vercel-managed Supabase environment variables.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}

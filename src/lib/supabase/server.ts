import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAuthCookieOptions } from './cookies';
import { getSupabaseUrl, getSupabasePublishableKey } from './env';

// Standard server client for RSC/route handlers acting on behalf of a
// logged-in user. Uses the publishable key; RLS policies always apply.
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured. Run `vercel link` then `vercel env pull .env.local` to load the Vercel-managed Supabase environment variables.'
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, getAuthCookieOptions(options, value))
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

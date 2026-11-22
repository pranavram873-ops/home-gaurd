import { createBrowserClient, type SetAllCookies } from '@supabase/ssr';
import { parse, serialize } from 'cookie';
import { AUTH_SESSION_MAX_AGE_SECONDS, getAuthCookieOptions } from './cookies';
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

  return createBrowserClient(supabaseUrl, supabaseKey, {
    cookieOptions: { maxAge: AUTH_SESSION_MAX_AGE_SECONDS },
    cookies: {
      getAll() {
        return Object.entries(parse(document.cookie)).flatMap(([name, value]) =>
          typeof value === 'string' ? [{ name, value }] : [],
        );
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serialize(name, value, getAuthCookieOptions(options, value));
        });
      },
    },
  });
}

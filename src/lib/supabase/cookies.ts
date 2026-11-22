import type { CookieOptions } from '@supabase/ssr';

export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getAuthCookieOptions(
  options: CookieOptions | undefined,
  value: string,
): CookieOptions {
  return {
    ...options,
    maxAge: value ? AUTH_SESSION_MAX_AGE_SECONDS : 0,
  };
}

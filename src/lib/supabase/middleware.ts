import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseUrl,
  getSupabasePublishableKey,
  isSupabaseConfigured,
} from './env';
import { getAuthCookieOptions } from './cookies';

// Routes a signed-in visitor should be sent away from.
const AUTH_ONLY_ROUTES = ['/login', '/register'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  const isAuthRoute = AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  // A recovery link must be able to reach the password form even when the
  // account's profile is pending or inactive. The recovery session only grants
  // access to the reset page; normal sign-in and protected routes stay gated.
  const isPasswordRecoveryRoute = pathname === '/reset-password' || pathname === '/confirm-recovery';

  const isAdminRoute = pathname.startsWith('/admin');
  const isInchargeRoute = pathname.startsWith('/incharge');
  const isHomeGuardRoute = pathname.startsWith('/homeguard');
  const isProtectedRoute = isAdminRoute || isInchargeRoute || isHomeGuardRoute;

  const redirect = (target: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = '';
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = NextResponse.redirect(url);
    // Any cookie the SSR client just wrote (a refreshed access token, or the
    // cleared recovery cookies) must survive the redirect or the session is lost.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  const dashboardFor = (role: string) => role === 'admin'
    ? '/admin/dashboard'
    : role === 'home_guard'
      ? '/homeguard/dashboard'
      : '/incharge/divisions';

  // ---------------------------------------------------------------------------
  // Supabase sessions. Every decision below is made from the verified JWT and
  // the personnel row RLS allows the caller to read; no cookie can stand in for
  // either.
  // ---------------------------------------------------------------------------
  if (!isSupabaseConfigured()) {
    // Fail closed: without a configured auth provider nobody may reach an
    // application area that expects an authenticated official.
    if (isProtectedRoute) {
      return redirect('/login', { error: 'auth_unavailable' });
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, getAuthCookieOptions(options, value))
        );
      },
    },
  });

  // getUser() validates the JWT with the project's keys and refreshes an expired
  // access token, writing the new cookies through setAll above.
  let user: User | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    if (isProtectedRoute) {
      return redirect('/login', { error: 'auth_unavailable' });
    }
    return supabaseResponse;
  }

  if (!user) {
    if (isProtectedRoute) {
      return redirect('/login', { redirect: pathname });
    }
    return supabaseResponse;
  }

  // RLS policy "Users can view own profile" limits this read to the caller's row.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    if (isProtectedRoute) {
      return redirect('/login', { error: 'auth_unavailable' });
    }
    return supabaseResponse;
  }

  if (!profile) {
    // Authenticated without a personnel profile: never allow a protected area.
    if (isProtectedRoute) {
      return redirect('/login', { error: 'missing_profile' });
    }
    return supabaseResponse;
  }

  if (profile.account_status !== 'active') {
    if (isProtectedRoute) {
      return redirect('/login', {
        error: profile.account_status === 'pending' ? 'pending_approval' : 'inactive_account',
      });
    }
    // The public root page checks the URL fragment for a Supabase recovery
    // session before sending ordinary visitors to sign-in. Fragments are not
    // sent to middleware, so let `/` reach that client-side check as well.
    if (!isAuthRoute && !isPasswordRecoveryRoute && pathname !== '/') {
      return redirect('/login', {
        error: profile.account_status === 'pending' ? 'pending_approval' : 'inactive_account',
      });
    }
  }

  const adminRegistrationPage = pathname === '/register' && profile.role === 'admin';
  if (isAuthRoute && profile.account_status === 'active' && !adminRegistrationPage) {
    return redirect(dashboardFor(profile.role));
  }

  if (isAdminRoute && profile.role !== 'admin') {
    return redirect(dashboardFor(profile.role));
  }

  if (isHomeGuardRoute && profile.role !== 'home_guard') {
    return redirect(dashboardFor(profile.role));
  }

  if (isInchargeRoute && profile.role === 'admin') {
    return redirect('/admin/dashboard');
  }

  if (isInchargeRoute && profile.role === 'home_guard') {
    return redirect('/homeguard/dashboard');
  }

  if (isInchargeRoute && !['/incharge/divisions', '/incharge/attendance', '/incharge/personnel', '/incharge/reports'].includes(pathname)) {
    return redirect('/incharge/divisions');
  }

  return supabaseResponse;
}

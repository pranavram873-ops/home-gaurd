import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getSupabaseUrl,
  getSupabasePublishableKey,
  isSupabaseConfigured,
  isDemoModeEnabled,
} from './env';

// Routes a signed-in visitor should be sent away from. `/reset-password` is
// excluded: it is only reachable while a password-recovery session is live.
const AUTH_ONLY_ROUTES = ['/login', '/register', '/forgot-password'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  const isAuthRoute = AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route));

  const isAdminRoute = pathname.startsWith('/admin');
  const isCommanderRoute = pathname.startsWith('/commander');
  const isHomeGuardRoute = pathname.startsWith('/homeguard');
  const isProtectedRoute = isAdminRoute || isHomeGuardRoute || isCommanderRoute;

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

  const dashboardFor = (role: string) => (role === 'admin' ? '/admin/dashboard' : '/homeguard/dashboard');

  // ---------------------------------------------------------------------------
  // Deliberate local demo mode only. Never reachable from a production build.
  // ---------------------------------------------------------------------------
  if (isDemoModeEnabled()) {
    const demoRoleCookie = request.cookies.get('tnhg_demo_role')?.value;
    const demoStatusCookie = request.cookies.get('tnhg_demo_status')?.value || 'active';

    if (demoRoleCookie) {
      if (demoStatusCookie !== 'active' && isProtectedRoute) {
        return redirect('/login', { error: 'inactive_account' });
      }
      if (isAuthRoute) {
        return redirect(dashboardFor(demoRoleCookie));
      }
      if (isAdminRoute && demoRoleCookie !== 'admin') {
        return redirect('/homeguard/dashboard');
      }
      if (isCommanderRoute) {
        return redirect('/homeguard/dashboard');
      }
      return supabaseResponse;
    }
  }

  // ---------------------------------------------------------------------------
  // Real Supabase sessions.
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
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as CookieOptions)
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

  const isRecoveryPath = pathname.startsWith('/reset-password');

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
    // A non-active account may still use the password-recovery and sign-out paths.
    if (!isRecoveryPath && !isAuthRoute) {
      return redirect('/login', {
        error: profile.account_status === 'pending' ? 'pending_approval' : 'inactive_account',
      });
    }
  }

  if (isAuthRoute && profile.account_status === 'active') {
    return redirect(dashboardFor(profile.role));
  }

  if (isAdminRoute && profile.role !== 'admin') {
    return redirect(dashboardFor(profile.role));
  }

  if (isCommanderRoute) {
    // Commander consoles are not implemented yet; keep them out of both roles.
    return redirect('/homeguard/dashboard');
  }

  return supabaseResponse;
}

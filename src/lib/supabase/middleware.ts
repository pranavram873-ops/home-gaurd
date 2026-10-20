import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Check for demo session cookie first (for testing/demo environment)
  const demoRoleCookie = request.cookies.get('tnhg_demo_role')?.value;
  const demoStatusCookie = request.cookies.get('tnhg_demo_status')?.value || 'active';

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  const isAdminRoute = pathname.startsWith('/admin');
  const isCommanderRoute = pathname.startsWith('/commander');
  const isHomeGuardRoute = pathname.startsWith('/homeguard');
  const isProtectedRoute = isAdminRoute || isHomeGuardRoute;

  // Handle demo mode authentication if set
  if (demoRoleCookie) {
    if (demoStatusCookie !== 'active' && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'inactive_account');
      return NextResponse.redirect(url);
    }

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      if (demoRoleCookie === 'admin') url.pathname = '/admin/dashboard';
      else url.pathname = '/homeguard/dashboard';
      return NextResponse.redirect(url);
    }

    // Role-based boundary enforcement in demo mode
    if (isAdminRoute && demoRoleCookie !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/homeguard/dashboard';
      return NextResponse.redirect(url);
    }

    if (isCommanderRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/homeguard/dashboard';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If real Supabase keys are configured, use Supabase SSR session
  if (supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (user) {
      // Fetch user profile from Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.account_status !== 'active' && isProtectedRoute) {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.searchParams.set('error', 'pending_approval');
          return NextResponse.redirect(url);
        }

        if (isAuthRoute) {
          const url = request.nextUrl.clone();
          if (profile.role === 'admin') url.pathname = '/admin/dashboard';
          else url.pathname = '/homeguard/dashboard';
          return NextResponse.redirect(url);
        }

        if (isAdminRoute && profile.role !== 'admin') {
          const url = request.nextUrl.clone();
          url.pathname = '/homeguard/dashboard';
          return NextResponse.redirect(url);
        }

        if (isCommanderRoute) {
          const url = request.nextUrl.clone();
          url.pathname = '/homeguard/dashboard';
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

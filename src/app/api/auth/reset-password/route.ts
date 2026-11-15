import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Always return the same response, whether the username exists or not.
const genericMessage = 'If an active account matches that username, a password reset link has been sent.';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!username || username.length > 80) return NextResponse.json({ error: 'Enter your username.' }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('id, email, account_status')
      .ilike('personnel_id', username)
      .maybeSingle();

    if (profileError) {
      console.error('[auth.reset-password] Profile lookup failed:', profileError.message);
      return NextResponse.json({ message: genericMessage });
    }

    // Pending registrations may still need to set or recover their password.
    // They remain unable to sign in until an administrator approves them.
    if (profile?.email && ['active', 'pending'].includes(profile.account_status)) {
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
      if (authUserError) console.error('[auth.reset-password] Auth account lookup failed:', authUserError.message);
      if (authUser.user?.email?.toLowerCase() === profile.email.toLowerCase()) {
        // Local development must send recovery links back to the local app,
        // even when NEXT_PUBLIC_APP_URL points at the deployed production site.
        // Production uses the configured canonical URL behind Vercel proxies.
        const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
        const origin = process.env.NODE_ENV === 'development'
          ? request.nextUrl.origin
          : configuredOrigin || request.nextUrl.origin;
        const { error: resetError } = await admin.auth.resetPasswordForEmail(profile.email, {
          redirectTo: `${origin}/reset-password`,
        });
        if (resetError) {
          // Do not log the username or destination email. The same response is
          // returned to valid and invalid usernames to prevent account discovery.
          console.error('[auth.reset-password] Supabase rejected recovery email:', resetError.message);
        }
      }
    }
    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    // Keep account existence private even when the mail provider fails.
    console.error('[auth.reset-password] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ message: genericMessage });
  }
}

import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Same alphabet and length as the account-creation route: a temporary password
 * the operator reads aloud once. It is never stored by the application.
 */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return `${out.slice(0, 12)}${randomInt(10)}${randomInt(10)}${randomInt(10)}${out.slice(12, 14)}`;
}

/**
 * Admin-initiated password reset. The officer's next sign-in uses the returned
 * temporary password; the application never stores it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';

  if (!userId) {
    return NextResponse.json({ error: 'A user id is required.' }, { status: 400 });
  }

  let sessionId: string | null = null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    sessionId = user?.id ?? null;

    if (sessionId) {
      const { data, error } = await supabase.rpc('is_admin');
      isAdmin = !error && data === true;
    }
  } catch {
    return NextResponse.json(
      { error: 'Administrator access could not be verified. Please try again.' },
      { status: 503 },
    );
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only an active administrator may reset passwords.' }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'The server is missing SUPABASE_SECRET_KEY, so passwords cannot be reset.' },
      { status: 500 },
    );
  }

  // Confirm the target is a real Auth user before touching anything.
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
  if (targetError || !target.user) {
    return NextResponse.json({ error: 'No login exists for this person.' }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const {
    data: { user: actor },
  } = await admin.auth.admin.getUserById(sessionId);

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: sessionId,
    actor_email: actor?.email ?? null,
    actor_role: 'admin',
    action: 'RESET_PASSWORD',
    target_type: 'profile',
    target_id: userId,
    details: { target_email: target.user.email ?? null },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json(
    { temporaryPassword, auditWarning: auditError ? auditError.message : null },
    { status: 200 },
  );
}

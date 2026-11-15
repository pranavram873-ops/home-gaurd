import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPublicRegistrationEnabled } from '@/lib/supabase/env';

export const runtime = 'nodejs';

const accountSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  username: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
  email: z.string().trim().email().max(254),
  phone: z.string().regex(/^[0-9]{10}$/),
  requestedRole: z.enum(['admin', 'incharge']),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  if (!isPublicRegistrationEnabled()) {
    return NextResponse.json({ error: 'Account creation is currently closed.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = accountSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the account details and try again.' }, { status: 400 });
  }

  const form = parsed.data;
  const username = form.username.toUpperCase();
  const email = form.email.toLowerCase();

  try {
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .ilike('personnel_id', username)
      .maybeSingle();

    if (lookupError) {
      console.error('[auth.register] Username lookup failed:', lookupError.message);
      return NextResponse.json({ error: 'Could not create the account right now. Please try again.' }, { status: 503 });
    }
    if (existing) {
      return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    }

    // Public registration was explicitly requested to create the selected role
    // immediately, so this server-only admin operation confirms the email and
    // activates the profile. Never trust a role from user metadata or a browser
    // profile write; role/status are assigned below with the secret client.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: form.password,
      email_confirm: true,
      user_metadata: {
        full_name: form.fullName,
        phone: form.phone,
        personnel_id: username,
      },
    });

    const userId = created.user?.id;
    if (createError || !userId) {
      const isDuplicate = /already|registered|duplicate/i.test(createError?.message ?? '');
      return NextResponse.json(
        { error: isDuplicate ? 'That email address is already in use.' : 'Could not create the account right now. Please try again.' },
        { status: isDuplicate ? 409 : 502 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: form.fullName,
        email,
        phone: form.phone,
        personnel_id: username,
        role: form.requestedRole,
        account_status: 'active',
        rank_designation: form.requestedRole === 'admin' ? 'Administrator' : 'Incharge',
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (profileError || !profile) {
      // Avoid leaving an Auth login that has no matching, usable application profile.
      await admin.auth.admin.deleteUser(userId);
      console.error('[auth.register] Profile activation failed:', profileError?.message ?? 'Profile row missing');
      return NextResponse.json({ error: 'Could not finish creating the account. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Account created. You can now sign in with your username and password.' }, { status: 201 });
  } catch (error) {
    console.error('[auth.register] Account creation failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Could not create the account right now. Please try again.' }, { status: 503 });
  }
}

import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { staffAccountSchema } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * A temporary password the operator reads aloud once. Sixteen characters from an
 * alphabet with no look-alikes, built from `randomInt` so it is not derived from
 * anything the client sent. The application never stores it: it exists only in
 * this response body, and the new officer is expected to change it through the
 * forgot-password flow on first use.
 */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += alphabet[randomInt(alphabet.length)];
  }
  // The Auth API requires both a letter and a digit; the alphabet makes that
  // near-certain over 16 draws, and this guarantees it rather than hoping.
  return `${out.slice(0, 12)}${randomInt(10)}${randomInt(10)}${randomInt(10)}${out.slice(12, 14)}`;
}

/**
 * Create a staff login on behalf of an administrator.
 *
 * This is the only place in the application that reads the secret key. Minting
 * an Auth user is an operation RLS cannot express - `profiles` has an insert
 * policy for `auth.uid() = id` only, so no browser client can create a row for
 * anybody else - and so the two steps that need privilege, `admin.createUser`
 * and the write that promotes the trigger-created pending row, happen here with
 * the service-role client. The caller's own authority is still checked with the
 * session client, exactly as a page would be.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const validation = staffAccountSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid personnel payload', details: validation.error.issues },
      { status: 400 },
    );
  }

  const input = validation.data;

  // 1. Who is asking, and are they an active administrator? Both answers come
  //    from the database, not from a cookie or a client-side role.
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
    return NextResponse.json(
      { error: 'Only an active administrator may add personnel to the roster.' },
      { status: 403 },
    );
  }

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'The server is missing SUPABASE_SECRET_KEY, so no login can be created.' },
      { status: 500 },
    );
  }

  // 2. The signup trigger resolves `district_code` and `unit_code`, so send the
  //    codes for the ids the operator picked. Resolving them first also rejects
  //    a stale id before an Auth user is created against it.
  const { data: districtRow, error: districtError } = await admin
    .from('districts')
    .select('id, code')
    .eq('id', input.district_id)
    .maybeSingle<{ id: string; code: string }>();

  if (districtError) {
    return NextResponse.json({ error: districtError.message }, { status: 500 });
  }
  if (!districtRow) {
    return NextResponse.json({ error: 'The selected district does not exist.' }, { status: 400 });
  }

  let unitCode: string | null = null;
  if (input.unit_id) {
    const { data: unitRow, error: unitError } = await admin
      .from('units')
      .select('id, code')
      .eq('id', input.unit_id)
      .maybeSingle<{ id: string; code: string }>();

    if (unitError) {
      return NextResponse.json({ error: unitError.message }, { status: 500 });
    }
    if (!unitRow) {
      return NextResponse.json({ error: 'The selected unit does not exist.' }, { status: 400 });
    }
    unitCode = unitRow.code;
  }

  const temporaryPassword = generateTemporaryPassword();

  // 3. The login itself. `email_confirm: true` because nobody is going to click a
  //    link in an official address the department handed us; the officer is told
  //    the temporary password directly.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email.toLowerCase().trim(),
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim(),
      phone: input.phone || undefined,
      district_code: districtRow.code,
      unit_code: unitCode || undefined,
    },
  });

  if (createError || !created.user) {
    const message = createError?.message || 'The login could not be created.';
    // Supabase answers a taken email with an ambiguous 422 to avoid user
    // enumeration. An administrator adding staff needs to know which one it is.
    const taken = /already/i.test(message);
    return NextResponse.json(
      { error: taken ? 'That email address already has a login on this roster.' : message },
      { status: taken ? 409 : 500 },
    );
  }

  const userId = created.user.id;

  // 4. `handle_new_user` has already inserted a pending `home_guard` row.
  //    Promote it to the rank and status the operator chose. The service badge
  //    is not written here: the `assign_personnel_badge` trigger issues it as
  //    this update moves the row into 'active', which keeps the UNIQUE check
  //    inside the database.
  const profilePatch = {
    full_name: input.full_name.trim(),
    email: created.user.email || input.email,
    phone: input.phone || null,
    role: input.role,
    rank_designation: input.rank_designation.trim(),
    district_id: input.district_id,
    unit_id: input.unit_id || null,
    blood_group: input.blood_group || null,
    emergency_contact: input.emergency_contact || null,
    address: input.address || null,
    account_status: 'active',
  };

  const { data: updatedRow, error: updateError } = await admin
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (updateError) {
    // The login exists but has no usable roster row. Roll it back rather than
    // leave an account that signs in to a blank profile.
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updatedRow) {
    // The trigger did not run, or its insert failed. Write the row directly so
    // this route works whether or not the signup hook is installed.
    const { error: insertError } = await admin.from('profiles').insert({ id: userId, ...profilePatch });
    if (insertError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // 5. Record who added whom. This is the one write the route makes with the
  //    service key for audit purposes, so the entry names the acting
  //    administrator explicitly rather than leaving `actor_id` null.
  const {
    data: { user: actor },
  } = await admin.auth.admin.getUserById(sessionId);

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: sessionId,
    actor_email: actor?.email ?? null,
    actor_role: 'admin',
    action: 'CREATE_STAFF_ACCOUNT',
    target_type: 'profile',
    target_id: userId,
    details: {
      full_name: profilePatch.full_name,
      email: profilePatch.email,
      role: profilePatch.role,
      rank_designation: profilePatch.rank_designation,
      district_code: districtRow.code,
    },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  // A missing audit row is reported but does not undo the account: the officer
  // can sign in, and the operations branch can reconstruct the event from the
  // roster itself.
  const auditWarning = auditError ? auditError.message : null;

  return NextResponse.json(
    {
      userId,
      email: profilePatch.email,
      temporaryPassword,
      auditWarning,
    },
    { status: 201 },
  );
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function isActiveAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return false;
  const { data, error } = await session.rpc('is_admin');
  return !error && data === true;
}

export async function GET() {
  try {
    if (!(await isActiveAdmin())) {
      return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data: profiles, error } = await admin
      .from('profiles')
      .select([
        'id', 'full_name', 'email', 'phone', 'personnel_id', 'blood_group',
        'emergency_contact', 'rank_designation', 'created_at',
        'districts!profiles_district_id_fkey ( name )',
        'units!profiles_unit_id_fkey ( name )',
      ].join(', '))
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = (profiles ?? []) as unknown as Array<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      personnel_id: string | null;
      blood_group: string | null;
      emergency_contact: string | null;
      rank_designation: string | null;
      created_at: string | null;
      districts: { name: string } | null;
      units: { name: string } | null;
    }>;
    const requests = await Promise.all(rows.map(async (profile) => {
      const { data: { user } } = await admin.auth.admin.getUserById(profile.id);
      const requested = user?.user_metadata?.requested_role;
      const requested_role = requested === 'admin' || requested === 'incharge' || requested === 'home_guard'
        ? requested
        : 'home_guard';
      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        personnel_id: profile.personnel_id,
        blood_group: profile.blood_group,
        emergency_contact: profile.emergency_contact,
        rank_designation: profile.rank_designation,
        created_at: profile.created_at,
        district_name: profile.districts?.name ?? null,
        unit_name: profile.units?.name ?? null,
        requested_role,
      };
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[admin.approvals] Could not load requests:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The account request queue could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isActiveAdmin())) {
      return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    const decision = body?.decision;
    if (!id || (decision !== 'approve' && decision !== 'reject')) {
      return NextResponse.json({ error: 'A valid account request decision is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: lookupError } = await admin
      .from('profiles')
      .select('id, account_status')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!profile || profile.account_status !== 'pending') {
      return NextResponse.json({ error: 'That account request has already been processed. Refresh the queue.' }, { status: 409 });
    }

    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(id);
    if (userError || !user) {
      return NextResponse.json({ error: 'The applicant login could not be verified.' }, { status: 409 });
    }
    const requested = user.user_metadata?.requested_role;
    const role = requested === 'admin' || requested === 'incharge' || requested === 'home_guard'
      ? requested
      : 'home_guard';
    const patch = decision === 'approve'
      ? { role, account_status: 'active', rank_designation: role === 'admin' ? 'Administrator' : role === 'incharge' ? 'Incharge' : 'Home Guard Volunteer' }
      : { account_status: 'rejected' };
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .eq('account_status', 'pending')
      .select('id, role, account_status')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return NextResponse.json({ error: 'That account request was already processed.' }, { status: 409 });
    return NextResponse.json({ ok: true, role: decision === 'approve' ? role : null });
  } catch (error) {
    console.error('[admin.approvals] Could not save decision:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The account request decision could not be saved.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';

  if (!username) {
    return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, account_status')
      .ilike('personnel_id', username.toUpperCase())
      .limit(1)
      .maybeSingle();

    if (error || !data?.email || data.account_status !== 'active') {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    // Supabase Auth remains the credential authority. A deleted Auth account
    // can leave its profiles row behind, so do not report that stale email as
    // a usable username.
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(data.id);
    if (authError || !authUser.user || authUser.user.email?.toLowerCase() !== data.email.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    return NextResponse.json({ email: data.email });
  } catch {
    return NextResponse.json(
      { error: 'Authentication service is unavailable.' },
      { status: 503 },
    );
  }
}

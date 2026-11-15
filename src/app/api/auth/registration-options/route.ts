import { NextResponse } from 'next/server';
import { isPublicRegistrationEnabled } from '@/lib/supabase/env';

export const runtime = 'nodejs';

export async function GET() {
  if (!isPublicRegistrationEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({ enabled: true });
}

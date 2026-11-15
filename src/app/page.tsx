'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Supabase can fall back to the Site URL (`/`) when a deployed reset request
// used an older or unapproved redirect target. Keep the landing route client
// rendered long enough to inspect the recovery fragment before routing away.
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const isRecovery = fragment.get('type') === 'recovery';
    router.replace(isRecovery ? `/reset-password${window.location.hash}` : '/login');
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center bg-surface text-sm text-on-surface-variant">Opening…</main>;
}

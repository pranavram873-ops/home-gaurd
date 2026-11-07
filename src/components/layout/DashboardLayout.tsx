'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDivision } from '@/lib/attendance/divisionContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * Mobile-first frame: the bottom nav is part of the design rather than a
 * fallback, so content reserves room for it and only steps out to the desktop
 * rail at `lg`.
 */
function DashboardFrame({ children, title, subtitle }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { divisionId, resolved } = useDivision();
  const requiresDivision = pathname === '/admin/personnel'
    || pathname === '/incharge/attendance';

  useEffect(() => {
    if (!resolved || divisionId || !requiresDivision) return;
    router.replace(pathname.startsWith('/admin') ? '/admin/divisions' : '/incharge/divisions');
  }, [divisionId, pathname, requiresDivision, resolved, router]);

  const waitingForDivision = requiresDivision && (!resolved || !divisionId);
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(36,89,138,.07),_transparent_32rem)] bg-surface text-on-surface">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pl-[264px] lg:pb-0">
        <Header title={title} subtitle={subtitle} />
        <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-5 sm:max-w-[1440px] sm:px-7 sm:py-8 lg:px-10">
          {waitingForDivision ? null : children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return <DashboardFrame {...props} />;
}

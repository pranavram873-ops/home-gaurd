'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DivisionProvider } from '@/lib/attendance/divisionContext';

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
export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <DivisionProvider>
      <div className="min-h-screen bg-surface text-on-surface">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pl-[264px] lg:pb-0">
          <Header title={title} subtitle={subtitle} />
          <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-5 sm:max-w-[1440px] sm:px-7 sm:py-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </DivisionProvider>
  );
}

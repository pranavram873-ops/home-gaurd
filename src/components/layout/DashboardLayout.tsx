'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pl-60 md:pb-0">
        <Header title={title} subtitle={subtitle} />
        <main className="w-full flex-1 px-3 py-4 sm:px-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/authContext';
import { LogOut } from 'lucide-react';

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { user, role, logout } = useAuth();

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur sm:px-5 md:px-6">
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg">
            {title || 'Home Guard Attendance'}
          </h1>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
            {role === 'admin' ? 'Admin' : role ? 'Incharge' : 'Secure'}
          </span>
        </div>
        <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle || todayStr}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden max-w-36 truncate text-sm font-medium text-slate-700 sm:block">{user?.full_name}</span>
        <button type="button" onClick={() => void logout()} aria-label="Sign out" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
      </div>
    </header>
  );
}

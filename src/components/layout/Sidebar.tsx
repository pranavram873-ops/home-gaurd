'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import { BarChart3, CalendarCheck, LogOut } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  const base = role === 'admin' ? '/admin' : '/incharge';
  const navLinks = [
    { label: 'Attendance', href: role === 'admin' ? '/admin/dashboard' : '/incharge/attendance', icon: CalendarCheck },
    { label: 'Reports', href: `${base}/reports`, icon: BarChart3 },
  ];

  return (
    <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col justify-between border-r border-slate-200 bg-white shadow-sm md:flex">
      <div>
        <div className="border-b border-slate-100 px-5 py-6"><p className="text-xs font-bold uppercase tracking-widest text-blue-800">Home Guards</p><p className="mt-1 text-lg font-bold text-slate-950">Attendance</p><p className="mt-1 text-sm text-slate-500">{role === 'admin' ? 'Administrator' : 'Incharge'}</p></div>
        <nav className="flex flex-col gap-1 p-3">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${isActive ? 'bg-blue-800 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-100 p-4"><p className="truncate text-sm font-semibold text-slate-900">{user?.full_name}</p><p className="mt-1 text-xs text-slate-500">{user?.personnel_id}</p><button onClick={() => void logout()} className="mt-3 flex h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut className="h-4 w-4" />Sign out</button></div>
    </aside>
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-slate-200 bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:hidden">
      {navLinks.map((item) => { const Icon = item.icon; const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${active ? 'text-blue-800' : 'text-slate-500'}`}><Icon className="h-5 w-5" /><span>{item.label}</span></Link>; })}
    </nav>
    </>
  );
}

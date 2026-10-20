'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  MapPin,
  ClipboardList,
  CalendarDays,
  BarChart3,
  LogOut,
  UserCheck,
  History,
  Shield,
  Radio,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  // Navigation menus according to role
  const getNavLinks = () => {
    if (role === 'admin') {
      return [
        { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Personnel Directory', href: '/admin/personnel', icon: Users },
        { label: 'Registration Approvals', href: '/admin/approvals', icon: UserCheck },
        { label: 'Duty Assignments', href: '/admin/assignments', icon: CalendarCheck },
        { label: 'Locations & Geofences', href: '/admin/locations', icon: MapPin },
        { label: 'Tasks Supervision', href: '/admin/tasks', icon: ClipboardList },
        { label: 'Event Planner', href: '/admin/events', icon: CalendarDays },
        { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      ];
    } else {
      // Home Guard
      return [
        { label: 'My Dashboard', href: '/homeguard/dashboard', icon: LayoutDashboard },
        { label: 'Check-In & Location', href: '/homeguard/location', icon: MapPin },
        { label: 'My Duty Schedule', href: '/homeguard/duties', icon: CalendarCheck },
        { label: 'Assigned Tasks', href: '/homeguard/tasks', icon: ClipboardList },
        { label: 'Attendance History', href: '/homeguard/attendance', icon: History },
        { label: 'My Profile', href: '/homeguard/profile', icon: UserCheck },
      ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col justify-between shadow-xs select-none">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Department Header with Official Logo */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center gap-3">
          <div className="relative w-11 h-11 shrink-0 rounded-full border border-blue-200/60 p-0.5 bg-white shadow-xs">
            <Image
              src="/images/tn-home-guards-logo.png"
              alt="Tamil Nadu Home Guards Emblem"
              width={44}
              height={44}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider truncate">
              GOVERNMENT OF TAMIL NADU
            </span>
            <span className="text-sm font-bold text-slate-900 tracking-tight leading-tight truncate">
              HOME GUARDS
            </span>
            <span className="text-[11px] font-medium text-slate-500 truncate">
              {role === 'admin'
                ? 'State Command HQ'
                : 'Field Personnel Roster'}
            </span>
          </div>
        </div>

        {/* Cadre & Live Status Pill */}
        <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="text-[11px] font-semibold text-blue-950 uppercase tracking-wider">
              {role === 'admin' ? 'Command Level 1' : 'On-Duty Verified'}
            </span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
            ACTIVE
          </span>
        </div>

        {/* Navigation Section */}
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operational Menu
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Information & Logout Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/60 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-900 shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-900 truncate">{user?.full_name || 'Personnel'}</span>
            <span className="text-[11px] text-blue-800 font-mono font-medium truncate">
              {user?.personnel_id || 'TN-HG-SEC'}
            </span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

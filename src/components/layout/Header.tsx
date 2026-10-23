'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/authContext';
import { dataService } from '@/lib/services/dataService';
import { UserRole } from '@/types';
import { Bell, ShieldCheck, UserCog, CheckCircle2, AlertTriangle } from 'lucide-react';

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { user, role, switchDemoRole, demoMode } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = user?.id ? dataService.getNotifications(user.id) : [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 right-0 left-64 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 z-40 px-6 flex items-center justify-between shadow-xs">
      {/* Title & Subtitle */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
            {title || 'Tamil Nadu Home Guards Command'}
          </h1>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 uppercase">
            {role ? role.replace('_', ' ') : 'SECURE'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="truncate">{subtitle || 'State Police Operational Supervision'}</span>
          <span>•</span>
          <span className="font-medium text-slate-600">{todayStr}</span>
        </div>
      </div>

      {/* Right Controls: Role Switcher & Notifications */}
      <div className="flex items-center gap-3">
        {/* Role switcher exists only in deliberate demo mode; a real session's
            role comes from the approved profile and cannot be changed client-side. */}
        {demoMode && (
          <>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              Demo data
            </span>
            <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => switchDemoRole('admin')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  role === 'admin'
                    ? 'bg-blue-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => switchDemoRole('home_guard')}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  role === 'home_guard'
                    ? 'bg-blue-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Home Guard
              </button>
            </div>
          </>
        )}

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200 bg-white"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Operational Alerts
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {notifications.length} Total
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto flex flex-col gap-2 divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="pt-2 first:pt-0 flex items-start gap-2 text-xs">
                      <div className="mt-0.5">
                        {n.type === 'alert' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-slate-800 leading-tight">{n.title}</span>
                        <p className="text-slate-600 text-[11px] leading-snug mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Details Tag */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex flex-col text-right hidden sm:flex">
            <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[140px]">
              {user?.full_name}
            </span>
            <span className="text-[10px] text-blue-800 font-mono font-semibold">
              {user?.personnel_id}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}

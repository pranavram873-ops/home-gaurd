'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/authContext';
import type { NotificationItem } from '@/types';
import { listNotifications, markNotificationRead } from '@/lib/services/notificationService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { Bell, CheckCircle2, AlertTriangle } from 'lucide-react';

export function Header({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { user, role } = useAuth();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);

  // The bell is the signed-in user's own rows: RLS on `notifications` only ever
  // returns those, so `user.id` is a filter for tidiness, not a permission check.
  const notificationsQuery = useLiveQuery<NotificationItem[]>(
    () =>
      user?.id
        ? listNotifications(user.id)
        : Promise.resolve({ data: [], error: null }),
    user?.id,
  );
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleNotificationClick(notification: NotificationItem) {
    const wasUnread = !notification.is_read;
    if (wasUnread && notificationsQuery.data) {
      // Read it locally first so the badge drops without a round trip, then let
      // the database agree. A failed write shows on the next open, not as an
      // error dialog over an alert the operator has already read.
      notificationsQuery.setData(
        notificationsQuery.data.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
      );
      void markNotificationRead(notification.id);
    }
    setShowNotifications(false);
    if (notification.link) router.push(notification.link);
  }

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

      {/* Right Controls: Notifications */}
      <div className="flex items-center gap-3">
        {/* There is no role switcher: a session's role comes from the approved
            personnel row and is decided by the administrator at the desk. */}

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) void notificationsQuery.refresh();
            }}
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
                {notificationsQuery.loading ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Loading alerts…</p>
                ) : notificationsQuery.error ? (
                  <p className="text-xs text-rose-700 py-3 text-center">{notificationsQuery.error}</p>
                ) : notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void handleNotificationClick(n)}
                      className={`pt-2 first:pt-0 flex items-start gap-2 text-xs text-left cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1 transition-colors ${
                        n.is_read ? '' : 'bg-blue-50/50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {n.type === 'alert' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 leading-tight">{n.title}</span>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0" />}
                        </span>
                        <p className="text-slate-600 text-[11px] leading-snug mt-0.5">{n.message}</p>
                      </div>
                    </button>
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

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { useAuth } from '@/lib/auth/authContext';
import {
  Users,
  UserCheck,
  MapPin,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Radio,
  FileSpreadsheet,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats] = useState(() => dataService.getAdminStats());
  const pendingApprovalsList = dataService.getPersonnel({ status: 'pending' });

  return (
    <DashboardLayout
      title="Headquarters Command Overview"
      subtitle="Tamil Nadu Home Guards & Civil Defence Directorate"
    >
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Welcome Command Banner */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-800 text-white tracking-wider">
                State Headquarters
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-600">Police HQ, Mylapore, Chennai</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Good day, {user?.full_name || 'State Commandant'}
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Synchronized operational oversight for all 38 District Home Guard Units. Live status reflects real-time biometric and GPS muster checks.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 beacon-pulse"></span>
              <span>All 38 Districts Online</span>
            </div>
          </div>
        </div>

        {/* Quick Action Palette */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/personnel?action=new"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 group-hover:bg-blue-800 group-hover:text-white transition-all">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Enrol Personnel</span>
                <span className="text-[11px] text-slate-500 truncate">Create or update profile</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/assignments"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-900 flex items-center justify-center shrink-0 group-hover:bg-indigo-800 group-hover:text-white transition-all">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Deploy Bandobast</span>
                <span className="text-[11px] text-slate-500 truncate">Schedule duty rosters</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/events"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 group-hover:bg-emerald-800 group-hover:text-white transition-all">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Plan Event</span>
                <span className="text-[11px] text-slate-500 truncate">VIP route & drills</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all" />
          </Link>

          <Link
            href="/admin/reports"
            className="flex items-center justify-between p-3.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl shadow-2xs transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 group-hover:bg-amber-800 group-hover:text-white transition-all">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate">Muster Reports</span>
                <span className="text-[11px] text-slate-500 truncate">Export attendance CSV</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        {/* 6-Grid Operational Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{stats.totalRegisteredGuards}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">State Cadre</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2">Active: {stats.activeGuards}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently On Duty</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-blue-900">{stats.onDutyCount}</span>
              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold animate-pulse">Live</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2">Scheduled: {stats.scheduledCount}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-amber-700">{stats.pendingApprovals}</span>
              {stats.pendingApprovals > 0 && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Review</span>
              )}
            </div>
            <Link href="/admin/approvals" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Manage Enrolments →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Geofences</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{stats.activeDutyLocations}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">150m Radius</span>
            </div>
            <Link href="/admin/locations" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              View Map →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Tasks</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{stats.pendingTasks}</span>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">Supervision</span>
            </div>
            <Link href="/admin/tasks" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Kanban Board →
            </Link>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Upcoming Events</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{stats.upcomingEvents}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Bandobast</span>
            </div>
            <Link href="/admin/events" className="text-[11px] text-blue-800 font-semibold hover:underline mt-2">
              Planner →
            </Link>
          </div>
        </div>

        {/* Two-Column Operational Section: Live Muster & Pending Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Live Biometric & Geofenced Attendance */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Attendance & Geofence Log</h3>
              </div>
              <Link href="/admin/reports" className="text-xs font-semibold text-blue-800 hover:underline">
                Full Muster Log
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-4">Personnel</th>
                    <th className="py-2.5 px-4">Service ID</th>
                    <th className="py-2.5 px-4">Duty Location</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Geofence Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No check-ins recorded for today yet.
                      </td>
                    </tr>
                  ) : (
                    stats.recentAttendance.map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {att.user?.full_name || 'Home Guard'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-900">
                          {att.user?.personnel_id || 'TN-HG-SEC'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">
                          {att.location?.name || 'Authorized Post'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              att.event_type === 'check_in'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {att.event_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {att.is_within_geofence ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Verified ({att.distance_meters}m)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Outside ({att.distance_meters}m)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approvals Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Pending Enlistments</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {pendingApprovalsList.length}
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
              {pendingApprovalsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  All volunteer enrolments have been processed.
                </div>
              ) : (
                pendingApprovalsList.slice(0, 4).map((p) => (
                  <div key={p.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{p.full_name}</span>
                        <span className="text-[11px] text-slate-500">{p.email}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                        {p.phone}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">District: Chennai</span>
                      <Link
                        href="/admin/approvals"
                        className="text-blue-800 font-bold hover:underline"
                      >
                        Review Application →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
            {pendingApprovalsList.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
                <Link
                  href="/admin/approvals"
                  className="text-xs font-bold text-blue-800 hover:text-blue-900"
                >
                  Go to Approvals Desk →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

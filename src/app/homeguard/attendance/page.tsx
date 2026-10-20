'use client';

import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { useAuth } from '@/lib/auth/authContext';
import { History, CheckCircle2, MapPin, Clock } from 'lucide-react';

export default function HomeGuardAttendancePage() {
  const { user } = useAuth();
  const userId = user?.id || 'usr-guard-1';
  const attendance = dataService.getAttendanceEvents({ userId });

  return (
    <DashboardLayout
      title="My Attendance & Biometric History"
      subtitle="Tamil Nadu Home Guards • Personnel Muster Register"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">Personal Muster Record ({attendance.length})</h2>
          <p className="text-xs text-slate-600 mt-1">
            Official immutable log of biometric and GPS verified check-in stamps.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-blue-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Duty Post Location</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Distance from Center</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {a.location?.name || 'Marina Beach Light House Post'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        a.event_type === 'check_in' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {a.event_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">
                    {a.distance_meters} meters
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Inside Geofence
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {new Date(a.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(a.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

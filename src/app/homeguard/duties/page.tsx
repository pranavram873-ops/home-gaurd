'use client';

import React from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { useAuth } from '@/lib/auth/authContext';
import { CalendarCheck, MapPin, Clock, ArrowRight } from 'lucide-react';

export default function HomeGuardDutiesPage() {
  const { user } = useAuth();
  const userId = user?.id || 'usr-guard-1';
  const duties = dataService.getDutyAssignments({ personnelId: userId });

  return (
    <DashboardLayout
      title="My Scheduled Duties"
      subtitle="Tamil Nadu Home Guards • Personnel Duty Roster"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">Personal Duty Schedule ({duties.length})</h2>
          <p className="text-xs text-slate-600 mt-1">
            Official deployment rosters assigned by Command Headquarters.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {duties.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
              No duty assignments currently scheduled.
            </div>
          ) : (
            duties.map((duty) => (
              <div
                key={duty.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                      {duty.duty_date}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        duty.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {duty.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{duty.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-800" />
                      {duty.location?.name || 'Post'}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {duty.start_time} - {duty.end_time}
                    </span>
                  </div>
                </div>

                <Link
                  href="/homeguard/location"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  <span>Open Check-In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

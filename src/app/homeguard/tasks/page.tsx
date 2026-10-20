'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { useAuth } from '@/lib/auth/authContext';
import { TaskStatus } from '@/types';
import { ClipboardList, CheckCircle2, Clock } from 'lucide-react';

export default function HomeGuardTasksPage() {
  const { user } = useAuth();
  const userId = user?.id || 'usr-guard-1';
  const [tasks, setTasks] = useState(() => dataService.getTasks({ assignedTo: userId }));

  const handleUpdate = (taskId: string, newStatus: TaskStatus) => {
    dataService.updateTaskStatus(taskId, newStatus, userId);
    setTasks(dataService.getTasks({ assignedTo: userId }));
  };

  return (
    <DashboardLayout
      title="My Assigned Tasks"
      subtitle="Tamil Nadu Home Guards • Directive Checkpoints"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">Assigned Operational Tasks ({tasks.length})</h2>
          <p className="text-xs text-slate-600 mt-1">
            Supervisory checks and field bandobast orders assigned to you.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Priority: {t.priority}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Due: {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">{t.title}</h3>
                  <p className="text-xs text-slate-600">{t.description}</p>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                      t.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Assigned by: <strong>{t.creator?.full_name || 'Area Commander'}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {t.status !== 'in_progress' && t.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdate(t.id, 'in_progress')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Start Task
                    </button>
                  )}
                  {t.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdate(t.id, 'completed')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Mark Complete ✓
                    </button>
                  )}
                  {t.status === 'completed' && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Task Completed & Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

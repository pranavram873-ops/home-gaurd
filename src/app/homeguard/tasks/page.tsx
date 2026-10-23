'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { listTasks, updateTaskStatus } from '@/lib/services/taskService';
import { useAuth } from '@/lib/auth/authContext';
import { TaskStatus, type TaskItem } from '@/types';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Paperclip } from 'lucide-react';

export default function HomeGuardTasksPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const tasksQuery = useLiveQuery<TaskItem[]>(
    () => (userId ? listTasks({ assignedTo: userId }) : Promise.resolve({ data: [], error: null })),
    userId ?? 'no-user',
  );

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleUpdate = async (taskId: string, newStatus: TaskStatus) => {
    if (!userId) return;
    setBusyId(taskId);
    setStatusError(null);

    const { data, error } = await updateTaskStatus(taskId, newStatus, userId);
    setBusyId(null);

    if (error || !data) {
      setStatusError(error || 'The task status could not be saved.');
      return;
    }
    // Replace only the card that moved, so the rest of the queue keeps its place.
    tasksQuery.setData(tasks.map((t) => (t.id === taskId ? data.task : t)));
  };

  return (
    <DashboardLayout
      title="My Assigned Tasks"
      subtitle="Tamil Nadu Home Guards • Directive Checkpoints"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900">
            Assigned Operational Tasks {!tasksQuery.loading && `(${tasks.length})`}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Supervisory checks and field bandobast orders assigned to you.
          </p>
        </div>

        {statusError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p>{statusError}</p>
          </div>
        )}

        {tasksQuery.loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your task queue...
          </div>
        ) : tasksQuery.error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Could not load your tasks</span>
              <p className="mt-0.5">{tasksQuery.error}</p>
              <button
                onClick={() => void tasksQuery.refresh()}
                className="mt-2 px-3 py-1 rounded-lg border border-rose-300 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center flex flex-col gap-2">
            <Paperclip className="w-6 h-6 text-slate-300 mx-auto" />
            <span className="text-sm font-bold text-slate-700">No tasks assigned to you</span>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Directories issued against your badge will appear here with their checkpoints.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Priority: {t.priority}
                      </span>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due:{' '}
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : 'No deadline'}
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
                    Assigned by: <strong>{t.creator?.full_name || 'Command Headquarters'}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    {t.status !== 'in_progress' && t.status !== 'completed' && (
                      <button
                        onClick={() => void handleUpdate(t.id, 'in_progress')}
                        disabled={busyId === t.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        Start Task
                      </button>
                    )}
                    {t.status !== 'completed' && (
                      <button
                        onClick={() => void handleUpdate(t.id, 'completed')}
                        disabled={busyId === t.id}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {busyId === t.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
        )}
      </div>
    </DashboardLayout>
  );
}

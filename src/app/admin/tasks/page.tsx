'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createTask, listTasks, updateTaskStatus } from '@/lib/services/taskService';
import { listActiveGuards } from '@/lib/services/personnelService';
import { pushNotification } from '@/lib/services/notificationService';
import { useAuth } from '@/lib/auth/authContext';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { Profile, TaskItem, TaskPriority, TaskStatus } from '@/types';
import { Icon } from '@/components/ui/Icon';

export default function TasksPage() {
  const { user } = useAuth();
  const tasksQuery = useLiveQuery<TaskItem[]>(() => listTasks());
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const guardsQuery = useLiveQuery<Profile[]>(() => listActiveGuards());
  const guards = useMemo(() => guardsQuery.data ?? [], [guardsQuery.data]);

  const blankForm = {
    title: '',
    description: '',
    priority: 'high' as TaskPriority,
    assigned_to: '',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  };
  const [formData, setFormData] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const assignee = guards.find((g) => g.id === formData.assigned_to) || null;

    const { data, error } = await createTask({
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      assigned_to: formData.assigned_to || null,
      // The directive must be attributable, because the update policy lets the
      // person who issued it change it as well as the guard holding it.
      assigned_by: user?.id ?? null,
      unit_id: assignee?.unit_id ?? null,
      due_date: formData.due_date || null,
    });

    setSaving(false);
    if (error || !data) {
      setFormError(error || 'The task could not be created.');
      return;
    }

    if (assignee) {
      // The kanban card is already committed; a bell item that fails to insert
      // is not a reason to trouble the operator.
      void pushNotification(assignee.id, {
        title: 'New supervisory directive',
        message: `${data.title} has been assigned to you with ${data.priority} priority.`,
        type: 'task',
        link: '/homeguard/tasks',
      });
    }

    tasksQuery.setData([data, ...(tasksQuery.data ?? [])]);
    setFormData({ ...blankForm, due_date: formData.due_date });
    setShowModal(false);
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setActionError(null);
    const { data, error } = await updateTaskStatus(taskId, newStatus, user?.id ?? null);
    if (error || !data) {
      setActionError(error || 'The task status could not be saved.');
      return;
    }
    // Replace the one card in place, so a transition does not spin the whole board.
    tasksQuery.setData(
      (tasksQuery.data ?? []).map((t) => (t.id === taskId ? data.task : t)),
    );
    if (newStatus === 'completed' && data.task.assigned_to) {
      void pushNotification(data.task.assigned_to, {
        title: 'Directive verified complete',
        message: `${data.task.title} has been marked completed and verified.`,
        type: 'task',
        link: '/homeguard/tasks',
      });
    }
  }

  const columns: { label: string; status: TaskStatus; color: string }[] = [
    { label: 'New Directives', status: 'new', color: 'border-outline-variant bg-surface-container-low' },
    { label: 'Assigned to Guards', status: 'assigned', color: 'border-outline-variant bg-primary-fixed/50' },
    { label: 'In Execution', status: 'in_progress', color: 'border-outline-variant bg-primary-fixed/50' },
    { label: 'Completed & Verified', status: 'completed', color: 'border-outline-variant bg-tertiary-fixed/50' },
  ];

  return (
    <DashboardLayout
      title="Tasks & Supervisory Kanban Board"
      subtitle="Tamil Nadu Home Guards • Directive Oversight"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Banner with Add Directive Action */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Field Supervision Kanban Board</h2>
            <p className="text-xs text-on-surface-variant">
              Assign and monitor bandobast standing orders, communications inspection, and security directives.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-on-primary font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Icon icon="add" size={16} />
            <span>Create Supervisory Task</span>
          </button>
        </div>

        {tasksQuery.error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container border border-error-container text-xs font-semibold text-on-error-container">
            <Icon icon="warning" size={16} className="shrink-0" />
            <span>{tasksQuery.error}</span>
            <button
              onClick={() => void tasksQuery.refresh()}
              className="ml-auto underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container border border-error-container text-xs font-semibold text-on-error-container">
            <Icon icon="warning" size={16} className="shrink-0" />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-auto cursor-pointer">
              <Icon icon="close" size={16} />
            </button>
          </div>
        )}

        {/* Kanban Board Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);

            return (
              <div
                key={col.status}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-2xs flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b border-outline-variant rounded-t-xl flex items-center justify-between ${col.color}`}>
                  <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant text-on-surface">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="p-3 flex flex-col gap-3 flex-1 overflow-y-auto">
                  {tasksQuery.loading ? (
                    <div className="text-center py-10 text-outline text-xs font-medium">
                      Loading directives…
                    </div>
                  ) : colTasks.length === 0 ? (
                    <div className="text-center py-10 text-outline text-xs font-medium">
                      No tasks in this lane
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-lg border border-outline-variant bg-surface-container-lowest shadow-2xs hover:shadow-xs transition-shadow flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-bold text-on-surface leading-snug">{t.title}</span>
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              t.priority === 'urgent'
                                ? 'bg-error-container text-on-error-container'
                                : t.priority === 'high'
                                ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        {t.description && (
                          <p className="text-[13px] text-on-surface-variant line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-[13px] text-on-surface-variant">
                          <span className="truncate max-w-[120px]">
                            {t.assignee?.full_name || 'Unassigned'}
                          </span>
                          <span className="font-mono text-xs">
                            {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No due date'}
                          </span>
                        </div>

                        {/* Quick Status Transition Toggle */}
                        <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between gap-1">
                          {col.status !== 'in_progress' && col.status !== 'completed' && (
                            <button
                              onClick={() => void handleStatusChange(t.id, 'in_progress')}
                              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                            >
                              Move to In Progress →
                            </button>
                          )}
                          {col.status === 'in_progress' && (
                            <button
                              onClick={() => void handleStatusChange(t.id, 'completed')}
                              className="text-xs font-semibold text-on-tertiary-container hover:underline cursor-pointer"
                            >
                              Mark Completed ✓
                            </button>
                          )}
                          {col.status === 'completed' && (
                            <span className="text-xs text-on-tertiary-container font-bold">✓ Verified</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Task Modal */}
        {showModal && (
          <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/40 p-4 backdrop-blur-xs">
            <div className="overlay-panel flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
              <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="assignment" size={20} className="text-primary" />
                  <h3 className="font-bold text-sm">Issue New Supervisory Task</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-on-primary hover:text-outline cursor-pointer"
                >
                  <Icon icon="close" size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3 text-xs">
                {guardsQuery.loading && (
                  <p className="px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant">
                    Loading approved guards…
                  </p>
                )}

                {!guardsQuery.loading && guards.length === 0 && (
                  <p className="px-3 py-2 rounded-lg bg-secondary-fixed border border-secondary-fixed text-on-secondary-fixed-variant">
                    There are no active guards to assign to. Approve an enrolment or add personnel first.
                  </p>
                )}

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="e.g. Conduct Wireless Transceiver Battery Audit"
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Instructions / Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="Details of duty inspection or check"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Assign Guard</label>
                    <select
                      required
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest"
                    >
                      <option value="">Choose a guard</option>
                      {guards.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.full_name} ({g.personnel_id || 'No badge'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                  />
                </div>

                {formError && (
                  <p className="px-3 py-2 rounded-lg bg-error-container border border-error-container text-on-error-container font-semibold">
                    {formError}
                  </p>
                )}

                <div className="pt-3 border-t border-outline-variant flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.assigned_to || guardsQuery.loading}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary cursor-pointer disabled:bg-surface-container-highest disabled:cursor-not-allowed"
                  >
                    {saving ? 'Issuing…' : 'Issue Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

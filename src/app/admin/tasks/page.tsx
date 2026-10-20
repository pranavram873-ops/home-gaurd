'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { TaskItem, TaskStatus, TaskPriority } from '@/types';
import {
  ClipboardList,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  ArrowRight,
  X,
  Filter,
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState(() => dataService.getTasks());
  const [showModal, setShowModal] = useState(false);
  const guards = dataService.getPersonnel({ role: 'home_guard', status: 'active' });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'high' as TaskPriority,
    assigned_to: guards[0]?.id || '',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.createTask({
      ...formData,
      status: 'assigned',
      unit_id: 'unt-chn-1',
    });
    setTasks(dataService.getTasks());
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      priority: 'high',
      assigned_to: guards[0]?.id || '',
      due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    dataService.updateTaskStatus(taskId, newStatus);
    setTasks(dataService.getTasks());
  };

  const columns: { label: string; status: TaskStatus; color: string }[] = [
    { label: 'New Directives', status: 'new', color: 'border-slate-300 bg-slate-50' },
    { label: 'Assigned to Guards', status: 'assigned', color: 'border-blue-300 bg-blue-50/50' },
    { label: 'In Execution', status: 'in_progress', color: 'border-indigo-300 bg-indigo-50/50' },
    { label: 'Completed & Verified', status: 'completed', color: 'border-emerald-300 bg-emerald-50/50' },
  ];

  return (
    <DashboardLayout
      title="Tasks & Supervisory Kanban Board"
      subtitle="Tamil Nadu Home Guards • Directive Oversight"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Banner with Add Directive Action */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Field Supervision Kanban Board</h2>
            <p className="text-xs text-slate-600">
              Assign and monitor bandobast standing orders, communications inspection, and security directives.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Supervisory Task</span>
          </button>
        </div>

        {/* Kanban Board Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);

            return (
              <div
                key={col.status}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b border-slate-200 rounded-t-xl flex items-center justify-between ${col.color}`}>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-800">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="p-3 flex flex-col gap-3 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs font-medium">
                      No tasks in this lane
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-bold text-slate-900 leading-snug">{t.title}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              t.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-800'
                                : t.priority === 'high'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        {t.description && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[120px]">
                            {t.assignee?.full_name || 'Unassigned'}
                          </span>
                          <span className="font-mono text-[10px]">
                            {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'No due date'}
                          </span>
                        </div>

                        {/* Quick Status Transition Toggle */}
                        <div className="pt-2 border-t border-slate-100/60 flex items-center justify-between gap-1">
                          {col.status !== 'in_progress' && col.status !== 'completed' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'in_progress')}
                              className="text-[10px] font-semibold text-blue-800 hover:underline cursor-pointer"
                            >
                              Move to In Progress →
                            </button>
                          )}
                          {col.status === 'in_progress' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'completed')}
                              className="text-[10px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                            >
                              Mark Completed ✓
                            </button>
                          )}
                          {col.status === 'completed' && (
                            <span className="text-[10px] text-emerald-700 font-bold">✓ Verified</span>
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-200" />
                  <h3 className="font-bold text-sm">Issue New Supervisory Task</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Conduct Wireless Transceiver Battery Audit"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Instructions / Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="Details of duty inspection or check"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Assign Guard</label>
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      {guards.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.full_name} ({g.personnel_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer"
                  >
                    Issue Task
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

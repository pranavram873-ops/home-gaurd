'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { DutyAssignment } from '@/types';
import {
  CalendarCheck,
  Plus,
  Clock,
  MapPin,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
} from 'lucide-react';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState(() => dataService.getDutyAssignments());
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const locations = dataService.getDutyLocations();
  const guards = dataService.getPersonnel({ role: 'home_guard', status: 'active' });

  // Group guards under their respective Unit names for unit-based selection
  const guardsByUnit = guards.reduce<Record<string, { name: string; guards: typeof guards }>>((acc, g) => {
    const unitId = g.unit?.id || 'unassigned';
    const unitName = g.unit?.name || 'Unassigned Unit';
    if (!acc[unitId]) acc[unitId] = { name: unitName, guards: [] };
    acc[unitId].guards.push(g);
    return acc;
  }, {});

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duty_location_id: locations[0]?.id || '',
    assigned_personnel_id: guards[0]?.id || '',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    reporting_instructions: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.createDutyAssignment({
      ...formData,
      status: 'scheduled',
    });
    setAssignments(dataService.getDutyAssignments());
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      duty_location_id: locations[0]?.id || '',
      assigned_personnel_id: guards[0]?.id || '',
      duty_date: new Date().toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '16:00',
      reporting_instructions: '',
    });
  };

  const filtered = assignments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.personnel?.full_name && a.personnel.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (a.location?.name && a.location.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout
      title="Duty Assignments & Bandobast Rosters"
      subtitle="Tamil Nadu Home Guards • Shift Scheduling"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Banner with Add Action */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Duty Roster Operations</h2>
            <p className="text-xs text-slate-600">
              Schedule bandobast deployments, patrol shifts, and crowd management duties across active posts.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Duty</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search duties, personnel or location..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Deployments: <strong className="text-blue-900">{filtered.length}</strong>
          </span>
        </div>

        {/* Duty Assignments Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Duty Title</th>
                  <th className="py-3 px-4">Assigned Personnel</th>
                  <th className="py-3 px-4">Duty Location</th>
                  <th className="py-3 px-4">Date & Shift</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((asg) => (
                  <tr key={asg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{asg.title}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                          {asg.description || 'Routine patrol'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {asg.personnel?.full_name || 'Assigned Volunteer'}
                      </span>
                      <span className="text-[10px] font-mono text-blue-900">
                        {asg.personnel?.personnel_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {asg.location?.name || 'Sector Outpost'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">{asg.duty_date}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {asg.start_time} - {asg.end_time}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          asg.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : asg.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {asg.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule Duty Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-200" />
                  <h3 className="font-bold text-sm">Schedule New Duty Assignment</h3>
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
                  <label className="font-bold text-slate-700 block mb-1">Duty Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Marina Beach Weekend Crowd Vigilance"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Duty Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="Describe operational responsibilities"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duty Location</label>
                    <select
                      value={formData.duty_location_id}
                      onChange={(e) => setFormData({ ...formData, duty_location_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Select Unit</label>
                    <select
                      value={formData.assigned_personnel_id}
                      onChange={(e) => setFormData({ ...formData, assigned_personnel_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="" disabled>
                        Choose a Home Guard Unit
                      </option>
                      {Object.entries(guardsByUnit).map(([unitId, group]) => (
                        <optgroup key={unitId} label={group.name}>
                          {group.guards.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.full_name} ({g.personnel_id})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duty Date</label>
                    <input
                      type="date"
                      required
                      value={formData.duty_date}
                      onChange={(e) => setFormData({ ...formData, duty_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reporting Instructions</label>
                  <input
                    type="text"
                    value={formData.reporting_instructions}
                    onChange={(e) => setFormData({ ...formData, reporting_instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Assemble 15 mins prior in complete uniform"
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
                    Assign Duty
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

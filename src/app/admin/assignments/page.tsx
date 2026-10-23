'use client';

import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  createDutyAssignment,
  listDutyAssignments,
  setAssignmentStatus,
} from '@/lib/services/assignmentService';
import { listDutyLocations } from '@/lib/services/referenceService';
import { listActiveGuards } from '@/lib/services/personnelService';
import { pushNotification } from '@/lib/services/notificationService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { DutyAssignment, DutyLocation, Profile } from '@/types';
import {
  CalendarCheck,
  Plus,
  MapPin,
  Users,
  AlertTriangle,
  X,
  Search,
  Ban,
} from 'lucide-react';

/** `duty_assignments.start_time` is a Postgres TIME, so 'HH:MM:SS'. */
function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

export default function AssignmentsPage() {
  const assignmentsQuery = useLiveQuery<DutyAssignment[]>(() => listDutyAssignments());
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // The two pickers are real rows: a duty cannot be filed against a post that
  // has not been surveyed, nor against a volunteer who has not been approved.
  const locationsQuery = useLiveQuery<DutyLocation[]>(() => listDutyLocations());
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);

  const guardsQuery = useLiveQuery<Profile[]>(() => listActiveGuards());
  const guards = useMemo(() => guardsQuery.data ?? [], [guardsQuery.data]);

  // Group guards under their respective Unit names for unit-based selection
  const guardsByUnit = useMemo(
    () =>
      guards.reduce<Record<string, { name: string; guards: Profile[] }>>((acc, g) => {
        const unitId = g.unit?.id || 'unassigned';
        const unitName = g.unit?.name || 'Unassigned Unit';
        if (!acc[unitId]) acc[unitId] = { name: unitName, guards: [] };
        acc[unitId].guards.push(g);
        return acc;
      }, {}),
    [guards],
  );

  // Form State
  const blankForm = {
    title: '',
    description: '',
    duty_location_id: '',
    assigned_personnel_id: '',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    reporting_instructions: '',
  };
  const [formData, setFormData] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === formData.duty_location_id) ?? null,
    [locations, formData.duty_location_id],
  );
  const selectedGuard = useMemo(
    () => guards.find((g) => g.id === formData.assigned_personnel_id) ?? null,
    [guards, formData.assigned_personnel_id],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        (a.personnel?.full_name && a.personnel.full_name.toLowerCase().includes(term)) ||
        (a.location?.name && a.location.name.toLowerCase().includes(term)),
    );
  }, [assignments, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    // `duty_assignments` carries its own district and unit so the reports and the
    // dashboard can group a duty without walking through its post. Both are taken
    // from the chosen post, falling back to the guard's own command.
    const { data, error } = await createDutyAssignment({
      title: formData.title,
      description: formData.description,
      duty_location_id: formData.duty_location_id,
      district_id: selectedLocation?.district_id || selectedGuard?.district_id || null,
      unit_id: selectedLocation?.unit_id || selectedGuard?.unit_id || null,
      assigned_personnel_id: formData.assigned_personnel_id,
      duty_date: formData.duty_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      reporting_instructions: formData.reporting_instructions,
    });

    setSaving(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (data) {
      // Splice the created row in rather than refetching the whole roster, so the
      // operator keeps their scroll position on a long list.
      assignmentsQuery.setData([data, ...(assignmentsQuery.data ?? [])]);
      // The duty is committed; the bell item is a courtesy, so its failure is not
      // surfaced as an error over a shift that is already on the roster.
      void pushNotification(data.assigned_personnel_id, {
        title: 'New duty assigned',
        message: `${data.title} on ${data.duty_date} at ${clock(data.start_time)}-${clock(data.end_time)}${
          data.location?.name ? ` at ${data.location.name}` : ''
        }.`,
        type: 'assignment',
        link: '/homeguard/duties',
      });
    }
    setFormData({ ...blankForm, duty_date: formData.duty_date });
    setShowModal(false);
  }

  async function handleCancelDuty(duty: DutyAssignment) {
    setStatusError(null);
    const { error } = await setAssignmentStatus(duty.id, 'cancelled');
    if (error) {
      setStatusError(error);
      return;
    }
    void assignmentsQuery.refresh();
  }

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
            onClick={() => {
              setFormError(null);
              setShowModal(true);
            }}
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

        {statusError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{statusError}</span>
            <button
              onClick={() => setStatusError(null)}
              className="ml-auto text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignmentsQuery.loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      Loading deployments…
                    </td>
                  </tr>
                ) : assignmentsQuery.error ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center">
                      <AlertTriangle className="w-5 h-5 text-rose-600 mx-auto mb-2" />
                      <p className="text-rose-800 font-semibold">{assignmentsQuery.error}</p>
                      <button
                        onClick={() => void assignmentsQuery.refresh()}
                        className="mt-2 text-[11px] font-bold text-blue-800 underline cursor-pointer"
                      >
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      {assignments.length === 0
                        ? 'No duties scheduled yet. A duty needs at least one surveyed duty post and one approved guard.'
                        : 'No deployment matches the search text within these duties.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((asg) => (
                    <tr key={asg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{asg.title}</span>
                          <span className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                            {asg.description || 'No description recorded'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {asg.personnel?.full_name || 'Personnel record removed'}
                        </span>
                        <span className="text-[10px] font-mono text-blue-900">
                          {asg.personnel?.personnel_id || 'No badge'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {asg.location?.name || 'Post no longer available'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 block">{asg.duty_date}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {clock(asg.start_time)} - {clock(asg.end_time)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            asg.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : asg.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : asg.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-500 line-through'
                              : asg.status === 'absent'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {asg.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {(asg.status === 'scheduled' || asg.status === 'in_progress') && (
                          <button
                            onClick={() => void handleCancelDuty(asg)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-[11px] font-bold transition-colors cursor-pointer"
                            title="Cancel this duty"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
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
                {(locationsQuery.loading || guardsQuery.loading) && (
                  <p className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                    Loading duty posts and approved guards…
                  </p>
                )}

                {!locationsQuery.loading && !guardsQuery.loading && (locations.length === 0 || guards.length === 0) && (
                  <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    {locations.length === 0
                      ? 'There are no duty posts on file. Add one under Duty Locations first.'
                      : 'There are no active Home Guards. Approve an enrolment or add personnel first.'}
                  </p>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Duty Title</label>
                  <input
                    type="text"
                    required
                    minLength={3}
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
                      required
                      value={formData.duty_location_id}
                      onChange={(e) => setFormData({ ...formData, duty_location_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">Select a post</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.radius_meters}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Guard</label>
                    <select
                      required
                      value={formData.assigned_personnel_id}
                      onChange={(e) => setFormData({ ...formData, assigned_personnel_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">Choose an active guard</option>
                      {Object.entries(guardsByUnit).map(([unitId, group]) => (
                        <optgroup key={unitId} label={group.name}>
                          {group.guards.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.full_name} ({g.personnel_id || 'No badge'})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {(selectedLocation || selectedGuard) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                    <span>
                      Filed under{' '}
                      <strong>
                        {selectedLocation?.district?.name || selectedGuard?.district?.name || 'no district'}
                      </strong>
                      {' · '}
                      <strong>{selectedLocation?.unit?.name || selectedGuard?.unit?.name || 'statewide'}</strong>
                    </span>
                  </div>
                )}

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

                {formError && (
                  <p className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                    {formError}
                  </p>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <Users className="w-4 h-4 text-slate-300 mr-auto self-center" />
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      locations.length === 0 ||
                      guards.length === 0 ||
                      locationsQuery.loading ||
                      guardsQuery.loading
                    }
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Assigning…' : 'Assign Duty'}
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

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createEvent, listEvents, setEventStatus } from '@/lib/services/eventService';
import { listDistricts, listDutyLocations } from '@/lib/services/referenceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { District, DutyLocation, EventItem, EventType, EventStatus } from '@/types';
import {
  CalendarDays,
  Plus,
  MapPin,
  Users,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';

function defaultStart(): string {
  return new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16);
}

function defaultEnd(): string {
  return new Date(Date.now() + 86400000 * 2 + 3600000 * 8).toISOString().slice(0, 16);
}

const STATUS_STYLE: Record<EventStatus, string> = {
  planned: 'text-amber-800 bg-amber-50',
  active: 'text-blue-800 bg-blue-50 animate-pulse',
  concluded: 'text-emerald-800 bg-emerald-50',
  cancelled: 'text-slate-500 bg-slate-100',
};

export default function EventsPlannerPage() {
  const eventsQuery = useLiveQuery<EventItem[]>(() => listEvents());
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Both pickers are database rows: `events.district_id` and
  // `events.duty_location_id` are foreign keys, so an operation can only be
  // filed against a district that exists and, optionally, a surveyed post.
  const locationsQuery = useLiveQuery<DutyLocation[]>(() => listDutyLocations());
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const districtsQuery = useLiveQuery<District[]>(() => listDistricts());
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data]);

  const blankForm = {
    title: '',
    description: '',
    event_type: 'bandobast' as EventType,
    venue: '',
    duty_location_id: '',
    district_id: '',
    required_personnel: 50,
    start_time: defaultStart(),
    end_time: defaultEnd(),
    duty_instructions: '',
  };
  const [formData, setFormData] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Picking a post fills in the district it belongs to, so the two can never
  // disagree on the row that gets written.
  useEffect(() => {
    if (districts.length === 0) return;
    setFormData((prev) =>
      prev.district_id && districts.some((d) => d.id === prev.district_id)
        ? prev
        : { ...prev, district_id: districts[0].id },
    );
  }, [districts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data, error } = await createEvent({
      title: formData.title,
      description: formData.description,
      event_type: formData.event_type,
      venue: formData.venue,
      duty_location_id: formData.duty_location_id || null,
      district_id: formData.district_id || null,
      required_personnel: formData.required_personnel,
      start_time: formData.start_time,
      end_time: formData.end_time,
      duty_instructions: formData.duty_instructions,
    });

    setSaving(false);
    if (error || !data) {
      setFormError(error || 'The operation could not be planned.');
      return;
    }

    // The planner sorts by start time, so a fresh row is placed by refetching
    // rather than by prepending it out of order.
    void eventsQuery.refresh();
    setFormData({ ...blankForm, district_id: formData.district_id, start_time: defaultStart(), end_time: defaultEnd() });
    setShowModal(false);
  }

  async function handleStatus(event: EventItem, status: EventStatus) {
    setActionError(null);
    const { error } = await setEventStatus(event.id, status);
    if (error) {
      setActionError(error);
      return;
    }
    eventsQuery.setData(
      (eventsQuery.data ?? []).map((e) => (e.id === event.id ? { ...e, status } : e)),
    );
  }

  function handleLocationChange(locationId: string) {
    const location = locations.find((l) => l.id === locationId);
    setFormData((prev) => ({
      ...prev,
      duty_location_id: locationId,
      district_id: location?.district_id || prev.district_id,
      venue: prev.venue || location?.address || '',
    }));
  }

  return (
    <DashboardLayout
      title="Event Planner & Major Bandobast"
      subtitle="Tamil Nadu Home Guards • Public Events & Operations"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Banner with Action */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Major Operations & Bandobast Planner</h2>
            <p className="text-xs text-slate-600">
              Mobilize and allocate platoons for festival bandobast, VIP route protection, and emergency drills.
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
            <span>Plan New Operation</span>
          </button>
        </div>

        {eventsQuery.error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{eventsQuery.error}</span>
            <button onClick={() => void eventsQuery.refresh()} className="ml-auto underline cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-auto cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Events Grid */}
        {eventsQuery.loading ? (
          <p className="text-xs text-slate-500 py-10 text-center">Loading operations…</p>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs py-14 text-center flex flex-col gap-1">
            <CalendarDays className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No operations planned yet</p>
            <p className="text-xs text-slate-500">
              Plan a bandobast and it will appear here with its required strength and standing orders.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                      {evt.event_type.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${STATUS_STYLE[evt.status]}`}>
                      {evt.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{evt.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {evt.description || 'Public crowd vigilance deployment'}
                  </p>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {new Date(evt.start_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {new Date(evt.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                      <span>
                        Mobilised: <strong>{evt.assigned_count ?? 0}</strong> of{' '}
                        <strong>{evt.required_personnel}</strong> Guards
                      </span>
                    </div>
                  </div>

                  {evt.duty_instructions && (
                    <div className="mt-1 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                      <span className="font-semibold block text-slate-900">Standing Orders:</span>
                      <span>{evt.duty_instructions}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] truncate">
                    {evt.district?.name || 'No district linked'}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {evt.status === 'planned' && (
                      <button
                        onClick={() => void handleStatus(evt, 'active')}
                        className="px-2.5 py-1 rounded-lg bg-blue-800 text-white font-bold text-[11px] hover:bg-blue-900 cursor-pointer"
                      >
                        Start
                      </button>
                    )}
                    {evt.status === 'active' && (
                      <button
                        onClick={() => void handleStatus(evt, 'concluded')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 cursor-pointer"
                      >
                        Conclude
                      </button>
                    )}
                    {(evt.status === 'planned' || evt.status === 'active') && (
                      <button
                        onClick={() => void handleStatus(evt, 'cancelled')}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 font-bold text-[11px] hover:bg-rose-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plan Event Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-200" />
                  <h3 className="font-bold text-sm">Plan Bandobast / Operation</h3>
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
                  <label className="font-bold text-slate-700 block mb-1">Operation Title</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Marina Republic Day Parade Rehearsal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Operation Category</label>
                    <select
                      value={formData.event_type}
                      onChange={(e) => setFormData({ ...formData, event_type: e.target.value as EventType })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="bandobast">Bandobast Duty</option>
                      <option value="crowd_control">Crowd Control</option>
                      <option value="traffic_management">Traffic Management</option>
                      <option value="emergency">Emergency Relief</option>
                      <option value="training">Training / Drill</option>
                      <option value="ceremonial">Ceremonial Parade</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Required Guards Count</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.required_personnel}
                      onChange={(e) => setFormData({ ...formData, required_personnel: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">District Command</label>
                    <select
                      required
                      value={formData.district_id}
                      onChange={(e) => setFormData({ ...formData, district_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">Select district</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Duty Post (optional)</label>
                    <select
                      value={formData.duty_location_id}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">No fixed post</option>
                      {locations
                        .filter((l) => !formData.district_id || l.district_id === formData.district_id)
                        .map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Venue / Route</label>
                  <input
                    type="text"
                    required
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Marina Beach Promenade (Kamarajar Salai)"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="What the operation covers"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">End Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Standing Orders / Duty Instructions</label>
                  <textarea
                    rows={2}
                    value={formData.duty_instructions}
                    onChange={(e) => setFormData({ ...formData, duty_instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="Special instructions for deployed platoons"
                  />
                </div>

                {formError && (
                  <p className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                    {formError}
                  </p>
                )}

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
                    disabled={saving || !formData.district_id || districts.length === 0}
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Planning…' : 'Confirm Operation'}
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

'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { EventItem, EventType } from '@/types';
import {
  CalendarDays,
  Plus,
  MapPin,
  Users,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function EventsPlannerPage() {
  const [events, setEvents] = useState(() => dataService.getEvents());
  const [showModal, setShowModal] = useState(false);
  const locations = dataService.getDutyLocations();

  // New Event Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'bandobast' as EventType,
    venue: '',
    duty_location_id: locations[0]?.id || '',
    required_personnel: 50,
    start_time: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 86400000 * 2 + 3600000 * 8).toISOString().slice(0, 16),
    duty_instructions: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.createEvent({
      ...formData,
      status: 'planned',
      district_id: 'dst-chn',
    });
    setEvents(dataService.getEvents());
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      event_type: 'bandobast',
      venue: '',
      duty_location_id: locations[0]?.id || '',
      required_personnel: 50,
      start_time: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      end_time: new Date(Date.now() + 86400000 * 2 + 3600000 * 8).toISOString().slice(0, 16),
      duty_instructions: '',
    });
  };

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
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Plan New Operation</span>
          </button>
        </div>

        {/* Events Grid */}
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
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">
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
                    <span>Required Strength: <strong>{evt.required_personnel} Guards</strong></span>
                  </div>
                </div>

                {evt.duty_instructions && (
                  <div className="mt-1 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                    <span className="font-semibold block text-slate-900">Standing Orders:</span>
                    <span>{evt.duty_instructions}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Command: Zone IV</span>
                <span className="font-bold text-blue-800">Deployment Active</span>
              </div>
            </div>
          ))}
        </div>

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
                      onChange={(e) => setFormData({ ...formData, required_personnel: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
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
                    Confirm Operation
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

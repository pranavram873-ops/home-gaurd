'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  createDutyLocation,
  listDistricts,
  listDutyLocations,
  listUnits,
} from '@/lib/services/referenceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { DutyLocation, District, Unit } from '@/types';
import {
  MapPin,
  Plus,
  Compass,
  X,
  Layers,
} from 'lucide-react';

const blankPost = {
  name: '',
  address: '',
  latitude: 13.0827,
  longitude: 80.2707,
  radius_meters: 150,
  district_id: '',
  unit_id: '',
};

export default function LocationsPage() {
  const locationsQuery = useLiveQuery<DutyLocation[]>(() => listDutyLocations());
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);

  const [selectedLoc, setSelectedLoc] = useState<DutyLocation | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Districts and units are read once and filtered in memory: the create form
  // only ever needs them when it is open, and `duty_locations` has a foreign key
  // to each, so a post cannot be filed against a district that does not exist.
  const districtsQuery = useLiveQuery<District[]>(() => listDistricts());
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data]);
  const unitsQuery = useLiveQuery<Unit[]>(() => listUnits());
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // New Location Form
  const [newLoc, setNewLoc] = useState({ ...blankPost });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // The map shows whichever post is selected, so default it to the first row and
  // drop the selection if a refresh removed the post it pointed at.
  useEffect(() => {
    if (locations.length === 0) {
      if (selectedLoc) setSelectedLoc(null);
      return;
    }
    if (!selectedLoc || !locations.some((l) => l.id === selectedLoc.id)) {
      setSelectedLoc(locations[0]);
    }
  }, [locations, selectedLoc]);

  // Default the form to the first real district once the reference data lands.
  useEffect(() => {
    if (districts.length === 0) return;
    setNewLoc((prev) =>
      prev.district_id && districts.some((d) => d.id === prev.district_id)
        ? prev
        : { ...prev, district_id: districts[0].id, unit_id: '' },
    );
  }, [districts]);

  const unitOptions = useMemo(
    () => units.filter((u) => !newLoc.district_id || u.district_id === newLoc.district_id),
    [units, newLoc.district_id],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data, error } = await createDutyLocation({
      name: newLoc.name,
      address: newLoc.address,
      latitude: newLoc.latitude,
      longitude: newLoc.longitude,
      radius_meters: newLoc.radius_meters,
      district_id: newLoc.district_id || null,
      unit_id: newLoc.unit_id || null,
      is_active: true,
    });

    setSaving(false);

    // The insert is refused by RLS for anyone who is not an administrator, and by
    // the foreign keys for a stale district, so the message must reach the form
    // rather than the page.
    if (error) {
      setFormError(error);
      return;
    }

    if (data) setSelectedLoc(data);
    setNewLoc({ ...blankPost, district_id: newLoc.district_id });
    setShowAddModal(false);
    void locationsQuery.refresh();
  }

  return (
    <DashboardLayout
      title="Geofenced Duty Locations & Sector Map"
      subtitle="Tamil Nadu Home Guards • Perimeter Geofencing"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Banner */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-200">
                GPS Geofence Perimeter
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">HAVERSINE ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Authorized Duty Locations & Posts</h2>
            <p className="text-xs text-slate-600">
              Configure authorized perimeter circles (100m - 250m) for automated muster validation.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Duty Location</span>
          </button>
        </div>

        {/* Map Visualization & Location Selector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Map Visualizer */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-800" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Post Geofence Perimeter: {selectedLoc?.name}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {selectedLoc ? `Radius: ${selectedLoc.radius_meters}m` : 'No post selected'}
              </span>
            </div>

            {/* Map Canvas */}
            <div className="relative h-96 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200">
              <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>

              {!selectedLoc ? (
                <div className="relative z-10 text-center px-6 py-8 bg-white/90 border border-slate-200 rounded-xl shadow-xs">
                  <MapPin className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    {locationsQuery.loading ? 'Loading duty posts…' : 'No duty post configured yet'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Add an authorized perimeter with its coordinates and geofence radius; guards can only
                    record a GPS muster inside one.
                  </p>
                </div>
              ) : (
                <>
                  {/* Geographic sector markers */}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-xs text-[11px] flex flex-col gap-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-800" />
                      {selectedLoc.name}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {selectedLoc.latitude.toFixed(4)}° N, {selectedLoc.longitude.toFixed(4)}° E
                    </span>
                    <span className="text-slate-600 text-[10px] truncate max-w-xs">{selectedLoc.address}</span>
                  </div>

                  {/* Center Post & Animated Geofence Circle */}
                  <div className="relative flex items-center justify-center">
                    <div
                      className="rounded-full border-2 border-dashed border-blue-600 bg-blue-500/15 flex items-center justify-center animate-pulse"
                      style={{ width: '260px', height: '260px' }}
                    >
                      <span className="text-[10px] font-bold text-blue-950 bg-white/95 px-2.5 py-1 rounded-full shadow-xs border border-blue-200">
                        {selectedLoc.radius_meters}m Perimeter Radius
                      </span>
                    </div>

                    <div className="absolute flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg border-2 border-white">
                        <MapPin className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span>Geofencing Engine: Server-side Haversine verification against WGS84 coordinates.</span>
              </div>
              <span className="font-semibold text-emerald-800">Tamper Resistant GPS Verification</span>
            </div>
          </div>

          {/* Locations List Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Configured Posts ({locations.length})
            </span>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[460px]">
              {locationsQuery.loading ? (
                <p className="text-xs text-slate-500 py-6 text-center">Loading duty posts…</p>
              ) : locationsQuery.error ? (
                <div className="py-6 text-center flex flex-col gap-2">
                  <p className="text-xs text-rose-700">{locationsQuery.error}</p>
                  <button
                    onClick={() => void locationsQuery.refresh()}
                    className="text-[11px] font-bold text-blue-800 underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : locations.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-6 text-center">
                  No posts recorded yet. Use <strong>Add Duty Location</strong> to file the first one.
                </p>
              ) : (
                locations.map((loc) => {
                  const isSelected = selectedLoc?.id === loc.id;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLoc(loc)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'border-blue-800 bg-blue-50/80 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-slate-900">{loc.name}</span>
                        <span className="text-[10px] font-mono font-bold text-blue-900 bg-blue-100 px-1.5 py-0.2 rounded">
                          {loc.radius_meters}m
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 truncate">{loc.address}</span>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                        <span>{loc.district?.name || 'No district linked'}</span>
                        <span
                          className={
                            loc.is_active
                              ? 'text-emerald-700 font-bold'
                              : 'text-slate-400 font-bold'
                          }
                        >
                          {loc.is_active ? 'Active Post' : 'Retired Post'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Add Duty Location Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-200" />
                  <h3 className="font-bold text-sm">Add Authorized Duty Post & Geofence</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Post / Location Name</label>
                  <input
                    type="text"
                    required
                    value={newLoc.name}
                    onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Besant Nagar Beach Promenade Post"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Address / Landmark</label>
                  <input
                    type="text"
                    required
                    value={newLoc.address}
                    onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. 6th Avenue, Besant Nagar, Chennai"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">District Command</label>
                    <select
                      required
                      value={newLoc.district_id}
                      onChange={(e) => setNewLoc({ ...newLoc, district_id: e.target.value, unit_id: '' })}
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
                    <label className="font-bold text-slate-700 block mb-1">Unit / Battalion</label>
                    <select
                      value={newLoc.unit_id}
                      disabled={!newLoc.district_id}
                      onChange={(e) => setNewLoc({ ...newLoc, unit_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">{newLoc.district_id ? 'Statewide (no unit)' : 'Select district first'}</option>
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newLoc.latitude}
                      onChange={(e) => setNewLoc({ ...newLoc, latitude: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newLoc.longitude}
                      onChange={(e) => setNewLoc({ ...newLoc, longitude: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Allowed Geofence Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    required
                    value={newLoc.radius_meters}
                    onChange={(e) => setNewLoc({ ...newLoc, radius_meters: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
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
                    onClick={() => {
                      setShowAddModal(false);
                      setFormError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || districts.length === 0}
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving Post…' : 'Save Geofence Post'}
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

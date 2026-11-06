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
import { GeofenceMap } from '@/components/maps/GeofenceMap';
import { PostPickerMap } from '@/components/maps/PostPickerMap';
import { DutyLocation, District, Unit } from '@/types';
import { Icon } from '@/components/ui/Icon';

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

  // The form opens on a default centre, so a coordinate that has never been
  // chosen is indistinguishable from one that has - until this is flipped by the
  // first search result or map click. Without it a post could be filed at the
  // default Chennai centre by someone who only meant to look at the map.
  const [placed, setPlaced] = useState(false);

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

  // The rest of the sector, drawn as context markers on the same map so an
  // operator can see where a new post would sit among the existing ones.
  // Excluding the selected post keeps its pin from being drawn twice.
  const otherPosts = useMemo(
    () =>
      locations
        .filter((l) => l.id !== selectedLoc?.id)
        .map((l) => ({ id: l.id, name: l.name, latitude: l.latitude, longitude: l.longitude })),
    [locations, selectedLoc],
  );

  const selectPost = (id: string) => {
    const loc = locations.find((l) => l.id === id);
    if (loc) setSelectedLoc(loc);
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // The button is disabled until then, but a form can also be submitted with
    // Enter, and a geofence filed at the default centre would Muster guards in
    // the wrong place.
    if (!placed) return;
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
    setPlaced(false);
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
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-primary-fixed text-primary border border-outline-variant">
                GPS Geofence Perimeter
              </span>
              <span className="text-xs font-mono font-bold text-on-surface-variant">HAVERSINE ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface mt-1">Authorized Duty Locations & Posts</h2>
            <p className="text-xs text-on-surface-variant">
              Configure authorized perimeter circles (100m - 250m) for automated muster validation.
            </p>
          </div>

          <button
            onClick={() => {
              // Re-opening a cancelled form must not inherit a pin from the last
              // attempt, or the next post saves at the previous post's place.
              setPlaced(false);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-on-primary font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Icon icon="add" size={16} />
            <span>Add Duty Location</span>
          </button>
        </div>

        {/* Map Visualization & Location Selector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interactive Map Visualizer */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <Icon icon="explore" size={16} className="text-primary" />
                <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                  Post Geofence Perimeter: {selectedLoc?.name}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-on-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded border border-outline-variant">
                {selectedLoc ? `Radius: ${selectedLoc.radius_meters}m` : 'No post selected'}
              </span>
            </div>

            {/* Map Canvas */}
            {selectedLoc ? (
              <div className="relative border-b border-outline-variant">
                <GeofenceMap
                  post={{
                    name: selectedLoc.name,
                    latitude: selectedLoc.latitude,
                    longitude: selectedLoc.longitude,
                    radiusMeters: selectedLoc.radius_meters,
                  }}
                  others={otherPosts}
                  onSelect={selectPost}
                  heightClass="h-96"
                />

                {/* Geographic sector markers */}
                <div className="pointer-events-none absolute top-4 left-4 max-w-[260px] bg-surface-container-lowest/90 backdrop-blur-xs p-2.5 rounded-lg border border-outline-variant shadow-xs text-[13px] flex flex-col gap-1">
                  <span className="font-bold text-on-surface flex items-center gap-1">
                    <Icon icon="location_on" size={14} className="text-primary" />
                    {selectedLoc.name}
                  </span>
                  <span className="text-on-surface-variant font-mono text-xs">
                    {selectedLoc.latitude.toFixed(4)}° N, {selectedLoc.longitude.toFixed(4)}° E
                  </span>
                  <span className="text-on-surface-variant text-xs">{selectedLoc.address}</span>
                  <span className="text-xs font-bold text-primary">
                    {selectedLoc.radius_meters}m perimeter radius
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative h-96 bg-surface-container flex items-center justify-center overflow-hidden border-b border-outline-variant">
                <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>

                <div className="relative z-10 text-center px-6 py-8 bg-surface-container-lowest/90 border border-outline-variant rounded-xl shadow-xs">
                  <Icon icon="location_on" size={24} className="text-outline mx-auto mb-2" />
                  <p className="text-xs font-bold text-on-surface-variant">
                    {locationsQuery.loading ? 'Loading duty posts…' : 'No duty post configured yet'}
                  </p>
                  <p className="text-[13px] text-on-surface-variant mt-1 max-w-xs">
                    Add an authorized perimeter with its coordinates and geofence radius; guards can only
                    record a GPS muster inside one.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <Icon icon="layers" size={16} className="text-outline" />
                <span>The circle is drawn to scale; a muster stamp is verified against it server-side.</span>
              </div>
              <span className="font-semibold text-on-tertiary-fixed-variant">Tamper Resistant GPS Verification</span>
            </div>
          </div>

          {/* Locations List Selector */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs p-4 flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Configured Posts ({locations.length})
            </span>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[460px]">
              {locationsQuery.loading ? (
                <p className="text-xs text-on-surface-variant py-6 text-center">Loading duty posts…</p>
              ) : locationsQuery.error ? (
                <div className="py-6 text-center flex flex-col gap-2">
                  <p className="text-xs text-on-error-container">{locationsQuery.error}</p>
                  <button
                    onClick={() => void locationsQuery.refresh()}
                    className="text-[13px] font-bold text-primary underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : locations.length === 0 ? (
                <p className="text-[13px] text-on-surface-variant py-6 text-center">
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
                          ? 'border-outline-variant bg-primary-fixed/80 shadow-xs'
                          : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-on-surface">{loc.name}</span>
                        <span className="text-xs font-mono font-bold text-primary bg-primary-fixed px-1.5 py-0.2 rounded">
                          {loc.radius_meters}m
                        </span>
                      </div>
                      <span className="text-[13px] text-on-surface-variant truncate">{loc.address}</span>
                      <div className="flex items-center justify-between text-xs text-outline pt-1 font-mono">
                        <span>{loc.district?.name || 'No district linked'}</span>
                        <span
                          className={
                            loc.is_active
                              ? 'text-on-tertiary-container font-bold'
                              : 'text-outline font-bold'
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
          <div className="fixed inset-0 bg-surface-container/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-outline-variant overflow-hidden flex flex-col">
              <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="location_on" size={20} className="text-primary" />
                  <h3 className="font-bold text-sm">Add Authorized Duty Post & Geofence</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-on-primary hover:text-outline cursor-pointer"
                >
                  <Icon icon="close" size={20} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 flex flex-col gap-3 text-xs overflow-y-auto">
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Post / Location Name</label>
                  <input
                    type="text"
                    required
                    value={newLoc.name}
                    onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="e.g. Besant Nagar Beach Promenade Post"
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Address / Landmark</label>
                  <input
                    type="text"
                    required
                    value={newLoc.address}
                    onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="e.g. 6th Avenue, Besant Nagar, Chennai"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">District Command</label>
                    <select
                      required
                      value={newLoc.district_id}
                      onChange={(e) => setNewLoc({ ...newLoc, district_id: e.target.value, unit_id: '' })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest"
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
                    <label className="font-bold text-on-surface-variant block mb-1">Unit / Battalion</label>
                    <select
                      value={newLoc.unit_id}
                      disabled={!newLoc.district_id}
                      onChange={(e) => setNewLoc({ ...newLoc, unit_id: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest disabled:bg-surface-container disabled:text-outline"
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

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Post Location</label>

                  <PostPickerMap
                    position={{ lat: newLoc.latitude, lng: newLoc.longitude }}
                    radiusMeters={newLoc.radius_meters}
                    name={newLoc.name}
                    onPlace={({ position, label }) => {
                      setNewLoc((prev) => ({
                        ...prev,
                        latitude: position.lat,
                        longitude: position.lng,
                        // A searched place fills the address only while the field
                        // is still empty: an operator who has typed the duty
                        // address has written the more authoritative record.
                        address: prev.address.trim() || (label ?? ''),
                      }));
                      setPlaced(true);
                    }}
                    heightClass="h-72"
                  />

                  <p className="text-[13px] text-on-surface-variant mt-1.5">
                    Search the place, then nudge the pin by dragging it or clicking the ground. The
                    circle is the perimeter a guard has to stand inside to stamp muster.
                  </p>
                </div>

                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                    placed ? 'bg-tertiary-fixed border-outline-variant' : 'bg-secondary-fixed border-secondary-fixed'
                  }`}
                >
                  <span className="text-[13px] font-mono text-on-surface-variant">
                    {placed
                      ? `${newLoc.latitude.toFixed(6)}° N, ${newLoc.longitude.toFixed(6)}° E`
                      : 'No coordinate chosen yet'}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      placed ? 'text-on-tertiary-fixed-variant' : 'text-on-secondary-fixed-variant'
                    }`}
                  >
                    {placed ? 'Pin placed' : 'Search or click the map to place the pin'}
                  </span>
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Allowed Geofence Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    required
                    value={newLoc.radius_meters}
                    onChange={(e) => setNewLoc({ ...newLoc, radius_meters: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface font-mono"
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
                    onClick={() => {
                      setShowAddModal(false);
                      setFormError(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !placed || districts.length === 0}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary cursor-pointer disabled:bg-surface-container-highest disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving Post…' : placed ? 'Save Geofence Post' : 'Place the pin first'}
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

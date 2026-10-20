'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { DutyLocation } from '@/types';
import {
  MapPin,
  Plus,
  Compass,
  Radio,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Layers,
} from 'lucide-react';

export default function LocationsPage() {
  const [locations, setLocations] = useState(() => dataService.getDutyLocations());
  const [selectedLoc, setSelectedLoc] = useState<DutyLocation | null>(locations[0] || null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Location Form
  const [newLoc, setNewLoc] = useState({
    name: '',
    address: '',
    latitude: 13.0827,
    longitude: 80.2707,
    radius_meters: 150,
    district_id: 'dst-chn',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const created = dataService.createDutyLocation({
      ...newLoc,
      is_active: true,
      unit_id: 'unt-chn-1',
    });
    setLocations(dataService.getDutyLocations());
    setSelectedLoc(created);
    setShowAddModal(false);
  };

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
                Radius: {selectedLoc?.radius_meters || 150}m
              </span>
            </div>

            {/* Map Canvas */}
            <div className="relative h-96 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200">
              <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>

              {/* Geographic sector markers */}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-xs text-[11px] flex flex-col gap-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-800" />
                  {selectedLoc?.name}
                </span>
                <span className="text-slate-500 font-mono text-[10px]">
                  {selectedLoc?.latitude.toFixed(4)}° N, {selectedLoc?.longitude.toFixed(4)}° E
                </span>
                <span className="text-slate-600 text-[10px] truncate max-w-xs">{selectedLoc?.address}</span>
              </div>

              {/* Center Post & Animated Geofence Circle */}
              <div className="relative flex items-center justify-center">
                <div
                  className="rounded-full border-2 border-dashed border-blue-600 bg-blue-500/15 flex items-center justify-center animate-pulse"
                  style={{ width: '260px', height: '260px' }}
                >
                  <span className="text-[10px] font-bold text-blue-950 bg-white/95 px-2.5 py-1 rounded-full shadow-xs border border-blue-200">
                    {selectedLoc?.radius_meters}m Perimeter Radius
                  </span>
                </div>

                <div className="absolute flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center shadow-lg border-2 border-white">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
              </div>
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
              {locations.map((loc) => {
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
                      <span>{loc.district?.name || 'Chennai Command'}</span>
                      <span className="text-emerald-700 font-bold">Active Post</span>
                    </div>
                  </button>
                );
              })}
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
                    <label className="font-bold text-slate-700 block mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={newLoc.latitude}
                      onChange={(e) => setNewLoc({ ...newLoc, latitude: parseFloat(e.target.value) })}
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
                      onChange={(e) => setNewLoc({ ...newLoc, longitude: parseFloat(e.target.value) })}
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
                    onChange={(e) => setNewLoc({ ...newLoc, radius_meters: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer"
                  >
                    Save Geofence Post
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

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  createStaffAccount,
  listPersonnel,
  type StaffAccountResult,
} from '@/lib/services/personnelService';
import { listDistricts, listUnits } from '@/lib/services/referenceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { AccountStatus, District, Profile, Unit, UserRole } from '@/types';
import {
  Search,
  Download,
  UserPlus,
  Eye,
  Shield,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
} from 'lucide-react';

const blankRecruit = {
  full_name: '',
  email: '',
  phone: '',
  role: 'home_guard' as UserRole,
  rank_designation: 'Home Guard Volunteer',
  district_id: '',
  unit_id: '',
  blood_group: '',
};

export default function PersonnelDirectoryPage() {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // The roster comes from `profiles`. RLS is what decides scope: an
  // administrator sees the statewide cadre, and anyone else would get only
  // their own row - which is why this screen is behind the admin layout.
  //
  // District, status and role are filtered in the query, because those narrow a
  // few thousand rows down to a handful cheaply. The free-text box is filtered
  // in memory on the result: sending it to Postgres would fire a request on
  // every keystroke for no benefit on a list already in hand.
  const rosterKey = `${districtFilter}|${statusFilter}|${roleFilter}`;
  const rosterQuery = useLiveQuery<Profile[]>(
    () =>
      listPersonnel({
        districtId: districtFilter === 'all' ? null : districtFilter,
        unitId: null,
        role: roleFilter,
        status: statusFilter,
      }),
    rosterKey,
  );
  const personnel = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  const districtsQuery = useLiveQuery<District[]>(() => listDistricts());
  const districts = useMemo(() => districtsQuery.data ?? [], [districtsQuery.data]);
  const unitsQuery = useLiveQuery<Unit[]>(() => listUnits());
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // New personnel form state
  const [newGuard, setNewGuard] = useState({ ...blankRecruit });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // The temporary password exists only in this response and this component. It
  // is never written to the database, so closing the panel is the only way it
  // can be lost - which is the intended behaviour.
  const [created, setCreated] = useState<StaffAccountResult | null>(null);

  useEffect(() => {
    if (districts.length === 0) return;
    setNewGuard((prev) =>
      prev.district_id && districts.some((d) => d.id === prev.district_id)
        ? prev
        : { ...prev, district_id: districts[0].id, unit_id: '' },
    );
  }, [districts]);

  const unitOptions = useMemo(
    () => units.filter((u) => !newGuard.district_id || u.district_id === newGuard.district_id),
    [units, newGuard.district_id],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return personnel;
    return personnel.filter((p) => {
      return (
        p.full_name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        (p.personnel_id && p.personnel_id.toLowerCase().includes(term)) ||
        (p.phone && p.phone.includes(term))
      );
    });
  }, [personnel, search]);

  function resetForm() {
    setNewGuard({ ...blankRecruit, district_id: newGuard.district_id });
    setFormError(null);
    setCreated(null);
  }

  async function handleCreateGuard(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data, error } = await createStaffAccount({
      full_name: newGuard.full_name,
      email: newGuard.email,
      phone: newGuard.phone || null,
      role: newGuard.role,
      rank_designation: newGuard.rank_designation,
      district_id: newGuard.district_id,
      unit_id: newGuard.unit_id || null,
      blood_group: newGuard.blood_group || null,
    });

    setSaving(false);

    if (error || !data) {
      setFormError(error || 'The staff account could not be created.');
      return;
    }

    setCreated(data);
    void rosterQuery.refresh();
  }

  const exportCSV = () => {
    const headers = ['Personnel ID', 'Full Name', 'Email', 'Phone', 'Role', 'Status', 'Rank'];
    const rows = filtered.map((p) => [
      p.personnel_id || '',
      `"${p.full_name}"`,
      p.email,
      p.phone || '',
      p.role,
      p.account_status,
      `"${p.rank_designation || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TN_Home_Guards_Roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout
      title="Personnel Directory & Roster"
      subtitle="Tamil Nadu Home Guards • State Metropolitan Command"
    >
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Banner with Action Buttons */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-200">
                Muster Command
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">STATEWIDE CADRE</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Tamil Nadu Home Guards Directory</h2>
            <p className="text-xs text-slate-600">
              Active field officers, platoon assignments, service numbers, and muster status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Export Roster CSV</span>
            </button>

            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Personnel</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, badge ID, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
            >
              <option value="all">All Districts (Statewide)</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | AccountStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active On Duty</option>
              <option value="pending">Pending Approval</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
            >
              <option value="all">All Ranks & Roles</option>
              <option value="admin">Administrators</option>
              <option value="home_guard">Home Guards</option>
            </select>
          </div>
        </div>

        {/* Personnel Directory Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              Showing <strong className="text-blue-900">{filtered.length}</strong> Personnel
            </span>
            {!rosterQuery.loading && !rosterQuery.error && personnel.length > 0 && (
              <button
                onClick={() => void rosterQuery.refresh()}
                className="text-[11px] font-bold text-blue-800 hover:text-blue-950 cursor-pointer"
              >
                Refresh roster
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Officer / Guard</th>
                  <th className="py-3 px-4">Badge Service ID</th>
                  <th className="py-3 px-4">Rank / Assignment</th>
                  <th className="py-3 px-4">District / Unit</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rosterQuery.loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Loading the cadre roster…
                    </td>
                  </tr>
                ) : rosterQuery.error ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center">
                      <AlertTriangle className="w-5 h-5 text-rose-600 mx-auto mb-2" />
                      <p className="text-rose-800 font-semibold">{rosterQuery.error}</p>
                      <button
                        onClick={() => void rosterQuery.refresh()}
                        className="mt-2 text-[11px] font-bold text-blue-800 underline cursor-pointer"
                      >
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      {personnel.length === 0
                        ? 'No personnel on the roster for these filters. Approved enrolments and added staff both appear here.'
                        : 'No row matches the search text within these filters.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center shrink-0">
                            {p.full_name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{p.full_name}</span>
                            <span className="text-[11px] text-slate-500">{p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-900">
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            p.personnel_id
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          {p.personnel_id || 'No badge'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {p.rank_designation || 'Volunteer'}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {p.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block">{p.district?.name || 'No district linked'}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {p.unit?.name || 'Statewide'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {p.phone || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.account_status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.account_status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.account_status === 'active'
                                ? 'bg-emerald-600'
                                : p.account_status === 'pending'
                                ? 'bg-amber-600'
                                : 'bg-rose-600'
                            }`}
                          ></span>
                          {p.account_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedProfile(p)}
                          className="p-1.5 rounded-lg text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View Profile Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Profile Detail Slide-over Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm">Personnel Service Dossier</h3>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-white hover:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-blue-800 text-white font-extrabold text-lg flex items-center justify-center">
                  {selectedProfile.full_name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-slate-900">{selectedProfile.full_name}</span>
                  <span className="font-mono text-blue-800 font-bold">
                    {selectedProfile.personnel_id || 'Badge not yet issued'}
                  </span>
                  <span className="text-slate-500">{selectedProfile.rank_designation}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold block">Official Email</span>
                  <span className="font-semibold text-slate-800 block mt-0.5 break-all">{selectedProfile.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Mobile Contact</span>
                  <span className="font-semibold font-mono text-slate-800 block mt-0.5">
                    {selectedProfile.phone || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Assigned District</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedProfile.district?.name || 'No district linked'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Unit / Battalion</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedProfile.unit?.name || 'Statewide (no unit)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Blood Group</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedProfile.blood_group || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Emergency Contact</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedProfile.emergency_contact || 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Role Category</span>
                  <span className="font-bold uppercase text-blue-900 block mt-0.5">{selectedProfile.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Account Status</span>
                  <span className="font-bold uppercase text-emerald-700 block mt-0.5">{selectedProfile.account_status}</span>
                </div>
              </div>

              {selectedProfile.address && (
                <div>
                  <span className="text-slate-400 font-bold block">Address</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{selectedProfile.address}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm">
                  {created ? 'Account Created' : 'Enrol New Home Guard Personnel'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white hover:text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {created ? (
              <div className="p-5 flex flex-col gap-3 text-xs">
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-emerald-900 font-semibold">
                    {newGuard.full_name} can sign in now. Their service badge is issued by the database and
                    appears on the roster.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
                  <div>
                    <span className="text-slate-400 font-bold block">Sign-in email</span>
                    <span className="font-mono font-semibold text-slate-900 block mt-0.5 break-all">
                      {created.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Temporary password</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-300 break-all">
                        {created.temporaryPassword}
                      </span>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(created.temporaryPassword)}
                        className="p-1.5 rounded-lg text-blue-800 hover:bg-blue-50 border border-slate-200 cursor-pointer shrink-0"
                        title="Copy password"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                  This password is shown once and is not stored by the portal. Hand it to the officer
                  directly and have them set their own before the first muster.
                </p>

                {created.auditWarning && (
                  <p className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                    The account works, but its audit entry failed to save: {created.auditWarning}
                  </p>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Add Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateGuard} className="p-5 flex flex-col gap-3 text-xs">
                {districts.length === 0 && !districtsQuery.loading && (
                  <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    No districts are seeded in the database yet, so a person cannot be filed anywhere.
                    Run the reference-data migration before adding personnel.
                  </p>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newGuard.full_name}
                    onChange={(e) => setNewGuard({ ...newGuard, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. S. Kannan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newGuard.email}
                      onChange={(e) => setNewGuard({ ...newGuard, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                      placeholder="kannan@tnhomeguards.gov.in"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={newGuard.phone}
                      onChange={(e) => setNewGuard({ ...newGuard, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                      placeholder="9840001122"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Rank / Designation</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={newGuard.rank_designation}
                      onChange={(e) => setNewGuard({ ...newGuard, rank_designation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Role</label>
                    <select
                      value={newGuard.role}
                      onChange={(e) => setNewGuard({ ...newGuard, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="home_guard">Home Guard Volunteer</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">District Command</label>
                    <select
                      required
                      value={newGuard.district_id}
                      onChange={(e) => setNewGuard({ ...newGuard, district_id: e.target.value, unit_id: '' })}
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
                      value={newGuard.unit_id}
                      disabled={!newGuard.district_id}
                      onChange={(e) => setNewGuard({ ...newGuard, unit_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">
                        {newGuard.district_id ? 'Statewide (no unit)' : 'Select district first'}
                      </option>
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
                    <label className="font-bold text-slate-700 block mb-1">Blood Group</label>
                    <input
                      type="text"
                      value={newGuard.blood_group}
                      onChange={(e) => setNewGuard({ ...newGuard, blood_group: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                      placeholder="Optional, e.g. O+"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="text-[11px] text-slate-500 leading-snug">
                      The login is created active, since an administrator is attesting to this person
                      in person. Self-enrolled applicants still go through the approvals desk.
                    </p>
                  </div>
                </div>

                {formError && (
                  <p className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                    {formError}
                  </p>
                )}

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
                    disabled={saving || !newGuard.district_id || districtsQuery.loading}
                    className="px-4 py-2 rounded-lg bg-blue-800 text-white font-bold hover:bg-blue-900 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Creating Login…' : 'Create Personnel Login'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

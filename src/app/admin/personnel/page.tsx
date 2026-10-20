'use client';

import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { dataService } from '@/lib/services/dataService';
import { Profile, UserRole, AccountStatus } from '@/types';
import {
  Users,
  Search,
  Filter,
  Download,
  UserPlus,
  Eye,
  Edit,
  Shield,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
} from 'lucide-react';

export default function PersonnelDirectoryPage() {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New personnel form state
  const [newGuard, setNewGuard] = useState({
    full_name: '',
    email: '',
    phone: '',
    personnel_id: '',
    role: 'home_guard' as UserRole,
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    rank_designation: 'Home Guard Volunteer',
    blood_group: 'O+',
  });

  const districts = dataService.getDistricts();
  const allPersonnel = dataService.getPersonnel();

  const filtered = useMemo(() => {
    return allPersonnel.filter((p) => {
      const matchSearch =
        !search ||
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        (p.personnel_id && p.personnel_id.toLowerCase().includes(search.toLowerCase())) ||
        (p.phone && p.phone.includes(search));

      const matchDistrict = districtFilter === 'all' || p.district_id === districtFilter;
      const matchStatus = statusFilter === 'all' || p.account_status === statusFilter;
      const matchRole = roleFilter === 'all' || p.role === roleFilter;

      return matchSearch && matchDistrict && matchStatus && matchRole;
    });
  }, [allPersonnel, search, districtFilter, statusFilter, roleFilter]);

  const handleCreateGuard = (e: React.FormEvent) => {
    e.preventDefault();
    dataService.createPersonnel({
      ...newGuard,
      account_status: 'active',
    });
    setShowAddModal(false);
    setNewGuard({
      full_name: '',
      email: '',
      phone: '',
      personnel_id: '',
      role: 'home_guard',
      district_id: 'dst-chn',
      unit_id: 'unt-chn-1',
      rank_designation: 'Home Guard Volunteer',
      blood_group: 'O+',
    });
  };

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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Roster CSV</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
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
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active On Duty</option>
              <option value="pending">Pending Approval</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-slate-900 bg-white"
            >
              <option value="all">All Ranks & Roles</option>
              <option value="admin">Administrators</option>
              <option value="commander">Commanders</option>
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
                {filtered.map((p) => (
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
                      <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                        {p.personnel_id || 'TN-HG-SEC'}
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
                      {p.district?.name || 'Chennai Greater City'}
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
                            p.account_status === 'active' ? 'bg-emerald-600' : 'bg-amber-600'
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
                ))}
              </tbody>
            </table>
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
                    <span className="font-mono text-blue-800 font-bold">{selectedProfile.personnel_id}</span>
                    <span className="text-slate-500">{selectedProfile.rank_designation}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 font-bold block">Official Email</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">{selectedProfile.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Mobile Contact</span>
                    <span className="font-semibold font-mono text-slate-800 block mt-0.5">{selectedProfile.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Assigned District</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">Chennai Greater City</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Blood Group</span>
                    <span className="font-semibold text-slate-800 block mt-0.5">{selectedProfile.blood_group || 'O+'}</span>
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
                  <h3 className="font-bold text-sm">Enrol New Home Guard Personnel</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGuard} className="p-5 flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
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
                      <option value="commander">Area Commander</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
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
                    Save Personnel Record
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

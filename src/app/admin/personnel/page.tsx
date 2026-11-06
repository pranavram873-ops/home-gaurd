'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  createStaffAccount,
  listPersonnel,
  type StaffAccountResult,
} from '@/lib/services/personnelService';
import { listDistricts, listUnits } from '@/lib/services/referenceService';
import { loadGuardDutyHistory, type GuardDutyHistory } from '@/lib/services/simpleAttendanceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { District, Profile, Unit, UserRole } from '@/types';
import { Icon } from '@/components/ui/Icon';

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

const PERSONNEL_DISTRICT_NAMES = [
  'Avinashi',
  'Dharapuram',
  'Kangeyam',
  'Palladam',
  'Udumalaipettai',
];

function normalizeDistrictName(name: string) {
  return name.trim().replace(/\s+district$/i, '').toLocaleLowerCase('en-IN');
}

export default function PersonnelDirectoryPage() {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // The roster comes from `profiles`. RLS is what decides scope: an
  // administrator sees the statewide cadre, and anyone else would get only
  // their own row - which is why this screen is behind the admin layout.
  //
  // District is filtered in the query, because it narrows a few thousand rows
  // down to a handful cheaply. The free-text box is filtered in memory on the
  // result: sending it to Postgres would fire a request on every keystroke for
  // no benefit on a list already in hand.
  const rosterQuery = useLiveQuery<Profile[]>(
    () =>
      listPersonnel({
        districtId: districtFilter === 'all' ? null : districtFilter,
        unitId: null,
        role: 'all',
        status: 'all',
      }),
    districtFilter,
  );
  const personnel = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  const districtsQuery = useLiveQuery<District[]>(() => listDistricts());
  const districts = useMemo(() => {
    const allowedNames = new Set(PERSONNEL_DISTRICT_NAMES.map((name) => name.toLocaleLowerCase('en-IN')));
    return (districtsQuery.data ?? [])
      .filter((district) => allowedNames.has(normalizeDistrictName(district.name)))
      .map((district) => ({
        ...district,
        name: PERSONNEL_DISTRICT_NAMES.find(
          (name) => name.toLocaleLowerCase('en-IN') === normalizeDistrictName(district.name),
        ) ?? district.name,
      }))
      .sort((a, b) => PERSONNEL_DISTRICT_NAMES.indexOf(a.name) - PERSONNEL_DISTRICT_NAMES.indexOf(b.name));
  }, [districtsQuery.data]);
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
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-primary-fixed text-primary border border-outline-variant">
                Muster Command
              </span>
              <span className="text-xs font-mono font-bold text-on-surface-variant">STATEWIDE CADRE</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface mt-1">Tamil Nadu Home Guards Directory</h2>
            <p className="text-xs text-on-surface-variant">
              Active field officers, platoon assignments, service numbers, and muster status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="download" size={16} />
              <span>Export Roster CSV</span>
            </button>

            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary text-on-primary font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Icon icon="person_add" size={16} />
              <span>Add Personnel</span>
            </button>
          </div>
        </div>

        {/* Filter deck: free-text search scoped by district. */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/40 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon icon="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, badge ID, phone..."
              aria-label="Search personnel"
              className="h-11 w-full pl-9 pr-3 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-on-surface placeholder:text-outline bg-surface-container-lowest"
            />
          </div>

          <div className="relative sm:w-72">
            <Icon icon="location_on" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              aria-label="Filter by district"
              className="h-11 w-full pl-9 pr-8 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-on-surface bg-surface-container-lowest appearance-none cursor-pointer"
            >
              <option value="all">All Districts (Statewide)</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Icon icon="expand_more" size={18} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          </div>
        </div>

        {/* Personnel roster: service number + name only. Tapping a row opens
            that person's profile; everything else lives inside it. */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface">
              <strong className="text-primary">{filtered.length}</strong>{' '}
              {filtered.length === 1 ? 'person found' : 'people found'}
              {search.trim() || districtFilter !== 'all' ? ' in this view' : ' in the directory'}
            </span>
            {!rosterQuery.loading && !rosterQuery.error && personnel.length > 0 && (
              <button
                onClick={() => void rosterQuery.refresh()}
                className="text-[13px] font-bold text-primary hover:text-primary cursor-pointer"
              >
                Refresh roster
              </button>
            )}
          </div>

          {rosterQuery.loading ? (
            <p className="py-10 text-center text-on-surface-variant text-sm">
              Loading the cadre roster…
            </p>
          ) : rosterQuery.error ? (
            <div className="py-10 text-center">
              <Icon icon="warning" size={20} className="text-on-error-container mx-auto mb-2" />
              <p className="text-on-error-container font-semibold">{rosterQuery.error}</p>
              <button
                onClick={() => void rosterQuery.refresh()}
                className="mt-2 text-[13px] font-bold text-primary underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-on-surface-variant text-sm">
              {personnel.length === 0
                ? 'No personnel on the roster for these filters. Approved enrolments and added staff both appear here.'
                : 'No row matches the search text within these filters.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-outline-variant">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(p)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    aria-label={`Open profile for ${p.full_name}`}
                  >
                    <span className="w-24 shrink-0 rounded-md bg-primary-fixed px-2 py-1 text-center font-mono text-[13px] font-bold text-primary">
                      {p.personnel_id || '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface">
                      {p.full_name}
                    </span>
                    <Icon icon="chevron_right" size={20} className="shrink-0 text-outline" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Profile modal: identity only - service number and name. */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-surface-container/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-sm w-full shadow-2xl border border-outline-variant overflow-hidden flex flex-col">
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="shield" size={20} className="text-on-primary" />
                <h3 className="font-bold text-sm">Personnel Profile</h3>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-on-primary hover:text-outline cursor-pointer"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary text-on-primary font-extrabold text-2xl flex items-center justify-center">
                {selectedProfile.full_name.charAt(0)}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-outline font-bold uppercase tracking-wider text-xs">Service Number</span>
                <span className="font-mono text-xl font-extrabold text-primary">
                  {selectedProfile.personnel_id || 'Badge not yet issued'}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Name</span>
                <span className="text-lg font-bold text-on-surface">{selectedProfile.full_name}</span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Mobile Number</span>
                <span className="text-lg font-semibold text-on-surface">
                  {selectedProfile.phone || 'Not provided'}
                </span>
              </div>

              <DutyHistorySection phone={selectedProfile.phone} />

              <button
                onClick={() => setSelectedProfile(null)}
                className="mt-2 w-full px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-surface-container/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full shadow-2xl border border-outline-variant overflow-hidden flex flex-col">
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="person_add" size={20} className="text-primary" />
                <h3 className="font-bold text-sm">
                  {created ? 'Account Created' : 'Enrol New Home Guard Personnel'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-primary hover:text-outline cursor-pointer"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>

            {created ? (
              <div className="p-5 flex flex-col gap-3 text-xs">
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-tertiary-fixed border border-outline-variant">
                  <Icon icon="check_circle" size={16} className="text-on-tertiary-container shrink-0 mt-0.5" />
                  <p className="text-on-tertiary-fixed-variant font-semibold">
                    {newGuard.full_name} can sign in now. Their service badge is issued by the database and
                    appears on the roster.
                  </p>
                </div>

                <div className="border border-outline-variant rounded-lg p-3 flex flex-col gap-2">
                  <div>
                    <span className="text-outline font-bold block">Sign-in email</span>
                    <span className="font-mono font-semibold text-on-surface block mt-0.5 break-all">
                      {created.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-outline font-bold block">Temporary password</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-on-surface bg-surface-container px-2 py-1 rounded border border-outline-variant break-all">
                        {created.temporaryPassword}
                      </span>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(created.temporaryPassword)}
                        className="p-1.5 rounded-lg text-primary hover:bg-primary-fixed border border-outline-variant cursor-pointer shrink-0"
                        title="Copy password"
                      >
                        <Icon icon="content_copy" size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="px-3 py-2 rounded-lg bg-secondary-fixed border border-secondary-fixed text-on-secondary-fixed-variant font-semibold">
                  This password is shown once and is not stored by the portal. Hand it to the officer
                  directly and have them set their own before the first muster.
                </p>

                {created.auditWarning && (
                  <p className="px-3 py-2 rounded-lg bg-error-container border border-error-container text-on-error-container">
                    The account works, but its audit entry failed to save: {created.auditWarning}
                  </p>
                )}

                <div className="pt-3 border-t border-outline-variant flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
                  >
                    Add Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateGuard} className="p-5 flex flex-col gap-3 text-xs">
                {districts.length === 0 && !districtsQuery.loading && (
                  <p className="px-3 py-2 rounded-lg bg-secondary-fixed border border-secondary-fixed text-on-secondary-fixed-variant">
                    No districts are seeded in the database yet, so a person cannot be filed anywhere.
                    Run the reference-data migration before adding personnel.
                  </p>
                )}

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newGuard.full_name}
                    onChange={(e) => setNewGuard({ ...newGuard, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="e.g. S. Kannan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newGuard.email}
                      onChange={(e) => setNewGuard({ ...newGuard, email: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                      placeholder="kannan@tnhomeguards.gov.in"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={newGuard.phone}
                      onChange={(e) => setNewGuard({ ...newGuard, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                      placeholder="9840001122"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Rank / Designation</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={newGuard.rank_designation}
                      onChange={(e) => setNewGuard({ ...newGuard, rank_designation: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Role</label>
                    <select
                      value={newGuard.role}
                      onChange={(e) => setNewGuard({ ...newGuard, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest"
                    >
                      <option value="home_guard">Home Guard Volunteer</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">District Command</label>
                    <select
                      required
                      value={newGuard.district_id}
                      onChange={(e) => setNewGuard({ ...newGuard, district_id: e.target.value, unit_id: '' })}
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
                      value={newGuard.unit_id}
                      disabled={!newGuard.district_id}
                      onChange={(e) => setNewGuard({ ...newGuard, unit_id: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface bg-surface-container-lowest disabled:bg-surface-container disabled:text-outline"
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
                    <label className="font-bold text-on-surface-variant block mb-1">Blood Group</label>
                    <input
                      type="text"
                      value={newGuard.blood_group}
                      onChange={(e) => setNewGuard({ ...newGuard, blood_group: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                      placeholder="Optional, e.g. O+"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="text-[13px] text-on-surface-variant leading-snug">
                      The login is created active, since an administrator is attesting to this person
                      in person. Self-enrolled applicants still go through the approvals desk.
                    </p>
                  </div>
                </div>

                {formError && (
                  <p className="px-3 py-2 rounded-lg bg-error-container border border-error-container text-on-error-container font-semibold">
                    {formError}
                  </p>
                )}

                <div className="pt-3 border-t border-outline-variant flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !newGuard.district_id || districtsQuery.loading}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary cursor-pointer disabled:bg-surface-container-highest disabled:cursor-not-allowed"
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

/**
 * Muster-register block inside the profile: Home Guard code and duty counts
 * for the current month, with a "See history" toggle for the months before.
 * The register is looked up lazily when a profile opens, keyed on the mobile
 * number, because `profiles` and the roster have no shared id.
 */
function DutyHistorySection({ phone }: { phone?: string | null }) {
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let live = true;
    setState('loading');
    setShowHistory(false);
    loadGuardDutyHistory(phone)
      .then((result) => {
        if (!live) return;
        setHistory(result);
        setState('ready');
      })
      .catch(() => {
        if (live) setState('error');
      });
    return () => {
      live = false;
    };
  }, [phone]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="w-full border border-outline-variant rounded-lg divide-y divide-outline-variant text-left">
      {state === 'loading' && (
        <p className="px-4 py-3 text-[13px] text-on-surface-variant">Checking the attendance register…</p>
      )}
      {state === 'error' && (
        <p className="px-4 py-3 text-[13px] font-semibold text-on-error-container">
          The attendance register could not be loaded.
        </p>
      )}
      {state === 'ready' && !history && (
        <p className="px-4 py-3 text-[13px] text-on-surface-variant">
          Not found in the attendance register, so duty counts are unavailable for this account.
        </p>
      )}
      {state === 'ready' && history && (
        <>
          <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-outline font-bold uppercase tracking-wider text-xs">Home Guard Code</span>
              <span className="font-mono text-sm font-bold text-on-surface">{history.homeGuardCode}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface-variant">
                Duties this month{history.divisionName ? ` · ${history.divisionName}` : ''}
              </span>
              <span className="text-lg font-extrabold text-primary tabular-nums">
                {history.months[0]?.present ?? 0}
              </span>
            </div>
          </div>
          {showHistory && (
            <ul className="px-4 py-2 flex flex-col">
              {history.months.slice(1).map((bucket) => (
                <li key={bucket.month} className="flex items-center justify-between py-1.5 text-[13px]">
                  <span className="font-semibold text-on-surface-variant">{monthLabel(bucket.month)}</span>
                  <span className="tabular-nums">
                    <strong className="text-primary">{bucket.present}</strong>
                    <span className="text-outline"> present</span>
                    {bucket.absent > 0 && (
                      <>
                        <span className="text-outline"> · </span>
                        <strong className="text-on-error-container">{bucket.absent}</strong>
                        <span className="text-outline"> absent</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-primary font-bold text-sm hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <Icon icon={showHistory ? 'expand_less' : 'history'} size={18} />
              <span>{showHistory ? 'Hide history' : 'See history'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  listPersonnel,
} from '@/lib/services/personnelService';
import { listDistricts } from '@/lib/services/referenceService';
import { addRosterGuard, listDivisionRoster, loadGuardDutyHistory, type GuardDutyHistory, type RosterGuard } from '@/lib/services/simpleAttendanceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { District, Profile } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { useDivision } from '@/lib/attendance/divisionContext';

const blankRecruit = {
  full_name: '',
  phone: '',
  personnel_id: '',
  district_id: '',
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
  const { divisionId, setDivisionId, resolved: divisionResolved } = useDivision();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('scope-error');
  const [divisionFilterReady, setDivisionFilterReady] = useState(false);
  const [districtScopeError, setDistrictScopeError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [memoCounts, setMemoCounts] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [rosterSyncError, setRosterSyncError] = useState<string | null>(null);

  // The roster comes from `profiles`. RLS is what decides scope: an
  // administrator sees the statewide cadre, and anyone else would get only
  // their own row - which is why this screen is behind the admin layout.
  //
  // District is filtered in the query, because it narrows a few thousand rows
  // down to a handful cheaply. The free-text box is filtered in memory on the
  // result: sending it to Postgres would fire a request on every keystroke for
  // no benefit on a list already in hand.
  const rosterQuery = useLiveQuery<Profile[]>(
    () => divisionFilterReady && !districtScopeError
      ? listPersonnel({
          districtId: districtFilter,
          unitId: null,
          role: 'all',
          status: 'all',
        })
      : Promise.resolve({ data: [], error: null }),
    `${districtFilter}:${divisionFilterReady}:${districtScopeError ?? ''}`,
  );
  const attendanceRosterQuery = useLiveQuery<RosterGuard[]>(
    () => divisionId ? listDivisionRoster(divisionId) : Promise.resolve({ data: [], error: null }),
    divisionId,
  );
  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const loadMemoCounts = async () => {
      const { data, error } = await supabase.from('guard_reports').select('subject_id');
      if (!live || error) return;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1;
      setMemoCounts(counts);
    };
    void loadMemoCounts();
    const channel = supabase.channel('personnel-memo-counts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guard_reports' }, (payload) => {
        const subjectId = (payload.new as { subject_id: string }).subject_id;
        setMemoCounts((current) => ({ ...current, [subjectId]: (current[subjectId] ?? 0) + 1 }));
      }).subscribe();
    return () => { live = false; void supabase.removeChannel(channel); };
  }, []);

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
  const selectedDistrict = districts.find((district) => district.id === districtFilter);
  const personnel = useMemo(() => {
    const profiles = rosterQuery.data ?? [];
    const knownCodes = new Set(profiles.map((profile) => profile.personnel_id?.toUpperCase()).filter(Boolean));
    const attendanceOnly = (attendanceRosterQuery.data ?? [])
      .filter((guard) => !knownCodes.has(guard.home_guard_code.toUpperCase()))
      .map((guard) => ({
        id: `attendance-${guard.id}`,
        full_name: guard.full_name,
        email: '',
        phone: guard.phone,
        personnel_id: guard.home_guard_code,
        role: 'home_guard' as const,
        district_id: selectedDistrict?.id ?? null,
        unit_id: null,
        account_status: 'active' as const,
        rank_designation: 'Home Guard Volunteer',
        created_at: '',
        updated_at: '',
        district: selectedDistrict ?? null,
        unit: null,
      } satisfies Profile));
    return [...profiles, ...attendanceOnly];
  }, [rosterQuery.data, attendanceRosterQuery.data, selectedDistrict]);

  // Older admin-created records were saved only in `profiles`. Bring those
  // active guards into the attendance roster when this admin directory loads.
  useEffect(() => {
    if (!divisionId || !selectedDistrict || rosterQuery.loading || rosterQuery.error) return;
    const legacyGuards = (rosterQuery.data ?? []).filter((profile) =>
      profile.role === 'home_guard'
      && profile.account_status === 'active'
      && Boolean(profile.personnel_id)
      && Boolean(profile.phone && /^[0-9]{10}$/.test(profile.phone)),
    );
    if (!legacyGuards.length) return;
    const supabase = createClient();
    void supabase.from('home_guard_roster').upsert(
      legacyGuards.map((profile) => ({
        division_id: divisionId,
        full_name: profile.full_name,
        phone: profile.phone!,
        home_guard_code: profile.personnel_id!,
        is_active: true,
      })),
      { onConflict: 'home_guard_code' },
    ).then(({ error }) => {
      if (error) {
        setRosterSyncError(`Existing Home Guards could not be added to the event roster: ${error.message}`);
      } else {
        setRosterSyncError(null);
        void attendanceRosterQuery.refresh();
      }
    });
  }, [divisionId, selectedDistrict, rosterQuery.data, rosterQuery.loading, rosterQuery.error]);

  useEffect(() => {
    let live = true;
    if (!divisionResolved || !divisionId) return;
    setDivisionFilterReady(false);
    setDistrictScopeError(null);
    const supabase = createClient();
    Promise.all([
      supabase.from('attendance_divisions').select('code, name').eq('id', divisionId).maybeSingle(),
      supabase.from('districts').select('id, code, name'),
    ]).then(([divisionResult, districtResult]) => {
      if (!live) return;
      if (divisionResult.error || districtResult.error || !divisionResult.data) {
        setDistrictFilter('scope-error');
        setDistrictScopeError('Could not match the selected division to its personnel district.');
        setDivisionFilterReady(true);
        return;
      }
      const division = divisionResult.data;
      const matchingDistrict = (districtResult.data ?? []).find((district) =>
        district.code?.toUpperCase() === division.code.toUpperCase()
        || normalizeDistrictName(district.name) === normalizeDistrictName(division.name),
      );
      if (!matchingDistrict) {
        setDistrictFilter('scope-error');
        setDistrictScopeError('No personnel district matches the selected division.');
      } else {
        setDistrictFilter(matchingDistrict.id);
      }
      setDivisionFilterReady(true);
    }).catch(() => {
      if (!live) return;
      setDistrictFilter('scope-error');
      setDistrictScopeError('Could not match the selected division to its personnel district.');
      setDivisionFilterReady(true);
    });
    return () => { live = false; };
  }, [divisionId, divisionResolved]);
  // New personnel form state
  const [newGuard, setNewGuard] = useState({ ...blankRecruit });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (districts.length === 0) return;
    setNewGuard((prev) =>
      !selectedDistrict || prev.district_id === selectedDistrict.id
        ? prev
        : { ...prev, district_id: selectedDistrict.id },
    );
  }, [districts, selectedDistrict]);

  async function handleDistrictChange(districtId: string) {
    setDistrictScopeError(null);
    setDistrictFilter(districtId);
    const district = districts.find((item) => item.id === districtId);
    if (!district) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('attendance_divisions')
      .select('id')
      .eq('code', district.code)
      .maybeSingle();
    if (error || !data) {
      setDistrictScopeError('Could not switch the selected division. Please reload and try again.');
      return;
    }
    setDivisionId(data.id);
  }

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
    setNewGuard({ ...blankRecruit, district_id: selectedDistrict?.id ?? '' });
    setFormError(null);
    setCreated(false);
  }

  async function handleCreateGuard(e: React.FormEvent) {
    e.preventDefault();
    if (!divisionId || !selectedDistrict) {
      setFormError('Select a division before adding a Home Guard.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addRosterGuard({
        full_name: newGuard.full_name,
        phone: newGuard.phone,
        home_guard_code: newGuard.personnel_id,
        division_id: divisionId,
      });
      setCreated(true);
      void attendanceRosterQuery.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The Home Guard could not be added.');
    } finally {
      setSaving(false);
    }

  }

  return (
    <DashboardLayout
      title="Personnel Directory & Roster"
      subtitle={selectedDistrict ? `Tamil Nadu Home Guards • ${selectedDistrict.name}` : 'Tamil Nadu Home Guards • Selected district'}
    >
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {rosterSyncError && (
          <div role="alert" className="rounded-lg bg-error-container p-4 text-sm text-on-error-container">
            {rosterSyncError}
          </div>
        )}
        {/* Banner with Action Buttons */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Tamil Nadu Home Guards Directory</h2>
          </div>

          <div className="flex items-center gap-2">
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
              onChange={(e) => void handleDistrictChange(e.target.value)}
              aria-label="Filter by district"
              className="h-11 w-full pl-9 pr-8 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-on-surface bg-surface-container-lowest appearance-none cursor-pointer"
            >
              {districtScopeError && <option value="scope-error">Selected district unavailable</option>}
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
              {search.trim() || districtFilter !== 'scope-error' ? ' in this view' : ' in the directory'}
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

          {districtScopeError ? (
            <div role="alert" className="m-4 rounded-lg bg-error-container p-4 text-sm text-on-error-container">
              {districtScopeError}
            </div>
          ) : rosterQuery.loading || !divisionFilterReady ? (
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
                    <span className="w-24 shrink-0 rounded-md bg-primary-fixed px-2 py-1 text-center font-mono text-[13px] font-bold text-on-primary-fixed">
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

      {/* Profile modal: identity and assigned division. */}
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
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Division</span>
                <span className="text-lg font-bold text-primary">
                  {selectedProfile.district?.name || 'Not assigned'}
                </span>
                <span className="text-outline font-bold uppercase tracking-wider text-xs mt-2">Mobile Number</span>
                <span className="text-lg font-semibold text-on-surface">
                  {selectedProfile.phone || 'Not provided'}
                </span>
              </div>

              <DutyHistorySection phone={selectedProfile.phone} />

              <div className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Memos on file</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-extrabold text-primary">
                  {memoCounts[selectedProfile.id] ?? 0}
                  <span className="text-sm font-medium text-on-surface-variant">{(memoCounts[selectedProfile.id] ?? 0) === 1 ? 'memo' : 'memos'}</span>
                </p>
              </div>

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
                  {created ? 'Home Guard Added' : 'Add Home Guard'}
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
                    {newGuard.full_name} was added to the {selectedDistrict?.name ?? 'selected'} division.
                  </p>
                </div>

                <p className="rounded-lg bg-surface-container p-3 text-on-surface-variant">
                  This Home Guard is now available in the incharge event roster.
                </p>

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
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Name</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={newGuard.full_name}
                    onChange={(e) => setNewGuard({ ...newGuard, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    placeholder="Enter full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Number</label>
                    <input
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={newGuard.phone}
                      onChange={(e) => setNewGuard({ ...newGuard, phone: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                      placeholder="10 digit mobile number"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Home Guard Code</label>
                    <input type="text" required maxLength={40} value={newGuard.personnel_id}
                      onChange={(e) => setNewGuard({ ...newGuard, personnel_id: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface uppercase" placeholder="e.g. TN-HG-12345" />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Division</label>
                    <select
                      required
                      value={districtFilter}
                      onChange={(event) => void handleDistrictChange(event.target.value)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                    >
                      {!selectedDistrict && <option value="">Select division</option>}
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>{district.name}</option>
                      ))}
                    </select>
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
                    disabled={saving || !selectedDistrict || districtsQuery.loading}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary cursor-pointer disabled:bg-surface-container-highest disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding Home Guard…' : 'Add Home Guard'}
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

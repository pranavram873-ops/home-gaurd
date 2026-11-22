'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  listPersonnel,
  resetStaffPassword,
  setAccountStatus,
} from '@/lib/services/personnelService';
import { listDistricts } from '@/lib/services/referenceService';
import { addRosterGuard, attendanceEventId, compressImage, deactivateHomeGuard, filePersonnelReport, listDivisionRoster, loadGuardDutyHistory, saveGuardProfileDates, type GuardDutyHistory, type RosterGuard } from '@/lib/services/simpleAttendanceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { District, Profile } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { useDivision } from '@/lib/attendance/divisionContext';
import { EventNameAutocomplete } from '@/components/reports/EventNameAutocomplete';
import { GuardPersonnelMemos } from '@/components/attendance/GuardPersonnelMemos';
import { EventDeleteDialog } from '@/components/attendance/EventDeleteDialog';

const blankRecruit = {
  full_name: '',
  phone: '',
  personnel_id: '',
  district_id: '',
  date_of_birth: '',
  joining_date: '',
};

function formatProfileDate(date: string | null | undefined) {
  if (!date) return 'Not provided';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false);
  const [deleteProfileError, setDeleteProfileError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ guardId: string; divisionId: string; name: string; code: string } | null>(null);
  const [reportCategory, setReportCategory] = useState('attendance');
  const [reportDescription, setReportDescription] = useState('');
  const [reportEventName, setReportEventName] = useState('');
  const [reportEventDate, setReportEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportPhoto, setReportPhoto] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [memoCounts, setMemoCounts] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [rosterSyncError, setRosterSyncError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

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

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const loadMemoCounts = async () => {
      const [legacyReports, personnelReports] = await Promise.all([
        supabase.from('guard_reports').select('subject_id'),
        supabase.from('personnel_reports').select('home_guard_code'),
      ]);
      if (!live) return;
      if (legacyReports.error || personnelReports.error) {
        console.error('Could not load personnel memo counts:', legacyReports.error || personnelReports.error);
        return;
      }

      const counts: Record<string, number> = {};
      for (const row of legacyReports.data ?? []) {
        counts[row.subject_id] = (counts[row.subject_id] ?? 0) + 1;
      }

      const profileIdByCode = new Map(
        personnel
          .filter((profile) => profile.personnel_id)
          .map((profile) => [profile.personnel_id!.toUpperCase(), profile.id]),
      );
      for (const report of personnelReports.data ?? []) {
        const profileId = profileIdByCode.get(report.home_guard_code.toUpperCase());
        if (profileId) counts[profileId] = (counts[profileId] ?? 0) + 1;
      }
      setMemoCounts(counts);
    };
    void loadMemoCounts();
    const channel = supabase.channel('personnel-memo-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guard_reports' }, () => {
        void loadMemoCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_reports' }, () => {
        void loadMemoCounts();
      })
      .subscribe();
    return () => { live = false; void supabase.removeChannel(channel); };
  }, [personnel]);

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

  // Password reset state (shown once inside the profile modal)
  const [resettingPassword, setResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

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

  async function handleDeleteProfile() {
    if (!selectedProfile) return;
    setDeletingProfile(true);
    setDeleteProfileError(null);
    try {
      const supabase = createClient();
      const code = selectedProfile.personnel_id || '';
      const { data: rosterGuard } = code
        ? await supabase.from('home_guard_roster').select('id').eq('home_guard_code', code).maybeSingle()
        : { data: null };
      if (rosterGuard) {
        await deactivateHomeGuard(rosterGuard.id, selectedProfile.phone ?? '', code);
      } else if (!selectedProfile.id.startsWith('attendance-')) {
        const result = await setAccountStatus(selectedProfile.id, 'suspended');
        if (!result.ok) throw new Error(result.error || 'Could not suspend this profile.');
      } else {
        throw new Error('This Home Guard is not in the attendance roster, so there is nothing to delete.');
      }
      setConfirmDeleteProfile(false);
      setSelectedProfile(null);
      void rosterQuery.refresh();
      void attendanceRosterQuery.refresh();
    } catch (error) {
      setDeleteProfileError(error instanceof Error ? error.message : 'The profile could not be deleted.');
    } finally {
      setDeletingProfile(false);
    }
  }

  async function attachReportPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCompressingPhoto(true);
    setReportError(null);
    try {
      setReportPhoto(await compressImage(file, 1200, 1200, 0.8));
    } catch {
      setReportError('Could not process that photo. Please try a different image.');
    } finally {
      setCompressingPhoto(false);
    }
  }

  async function openReportModal() {
    if (!selectedProfile) return;
    setReportCategory('attendance');
    setReportDescription('');
    setReportEventName('');
    setReportEventDate(new Date().toISOString().slice(0, 10));
    setReportPhoto(null);
    setReportError(null);
    setReportSuccess(false);
    const code = selectedProfile.personnel_id || '';
    const supabase = createClient();
    const { data: rosterGuard } = code
      ? await supabase.from('home_guard_roster').select('id, division_id').eq('home_guard_code', code).maybeSingle()
      : { data: null };
    setReportTarget(rosterGuard
      ? { guardId: rosterGuard.id, divisionId: rosterGuard.division_id, name: selectedProfile.full_name, code }
      : null);
    if (!rosterGuard) {
      setReportError('This person is not in the attendance roster, so a report cannot be filed against them.');
    }
    setReportOpen(true);
  }

  async function submitPersonnelReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reportTarget || reportDescription.trim().length < 10 || !reportEventName.trim() || !reportPhoto) return;
    setSubmittingReport(true);
    setReportError(null);
    try {
      await filePersonnelReport({
        guardId: reportTarget.guardId,
        divisionId: reportTarget.divisionId,
        category: reportCategory,
        description: reportDescription,
        evidencePhoto: reportPhoto,
        eventName: reportEventName,
        eventDate: reportEventDate,
      });
      if (selectedProfile) {
        setMemoCounts((current) => ({
          ...current,
          [selectedProfile.id]: (current[selectedProfile.id] ?? 0) + 1,
        }));
      }
      setReportOpen(false);
      setReportDescription('');
      setReportEventName('');
      setReportPhoto(null);
      setReportSuccess(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Could not submit the report. Try again.');
    } finally {
      setSubmittingReport(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedProfile || selectedProfile.id.startsWith('attendance-')) return;
    setResettingPassword(true);
    setDeleteProfileError(null);
    setTempPassword(null);
    try {
      const result = await resetStaffPassword(selectedProfile.id);
      if (result.error || !result.data) {
        setDeleteProfileError(result.error || 'The password could not be reset.');
        return;
      }
      setTempPassword(result.data.temporaryPassword);
    } catch (error) {
      setDeleteProfileError(error instanceof Error ? error.message : 'The password could not be reset.');
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleCreateGuard(e: React.FormEvent) {
    e.preventDefault();
    if (!divisionId || !selectedDistrict) {
      setFormError('Select a division before adding a Home Guard.');
      return;
    }
    if (newGuard.joining_date < newGuard.date_of_birth) {
      setFormError('Joining date cannot be earlier than the date of birth.');
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
        date_of_birth: newGuard.date_of_birth,
        joining_date: newGuard.joining_date,
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
      <div className="flex flex-col gap-6 max-w-7xl mx-auto xl:max-w-none">
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

          <div className="flex flex-wrap items-center gap-2">
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
            <ul className="stagger-in flex flex-col divide-y divide-outline-variant">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setReportSuccess(false); setDeleteProfileError(null); setTempPassword(null); setSelectedProfile(p); }}
                    className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-[0.99]"
                    aria-label={`Open profile for ${p.full_name}`}
                  >
                    <span className="w-24 shrink-0 rounded-md bg-primary-fixed px-2 py-1 text-center font-mono text-[13px] font-bold text-on-primary-fixed transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
                      {p.personnel_id || '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface transition-colors group-hover:text-primary">
                      {p.full_name}
                    </span>
                    <Icon icon="chevron_right" size={20} className="shrink-0 text-outline transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Profile modal: identity and assigned division. */}
      {portalReady && selectedProfile && createPortal((
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/40 p-3 backdrop-blur-xs sm:p-4">
          <div className="overlay-panel flex h-auto max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
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

            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-left sm:p-5">
              <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-on-primary">
                  {selectedProfile.full_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-on-surface">{selectedProfile.full_name}</p>
                  <p className="font-mono text-xs font-bold text-primary">{selectedProfile.personnel_id || 'Badge not yet issued'}</p>
                </div>
              </div>
              <div className="grid w-full grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-container-low p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Division</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-primary">{selectedProfile.district?.name || 'Not assigned'}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Mobile</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-on-surface">{selectedProfile.phone || 'Not provided'}</p>
                </div>
              </div>

              <DutyHistorySection phone={selectedProfile.phone} />

              <div className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Memos on file</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-extrabold text-primary">
                  {memoCounts[selectedProfile.id] ?? 0}
                  <span className="text-sm font-medium text-on-surface-variant">{(memoCounts[selectedProfile.id] ?? 0) === 1 ? 'memo' : 'memos'}</span>
                </p>
                <GuardPersonnelMemos
                  guardId={attendanceRosterQuery.data?.find(
                    (guard) => guard.home_guard_code.toUpperCase() === selectedProfile.personnel_id?.toUpperCase(),
                  )?.id ?? null}
                  onNavigate={() => setSelectedProfile(null)}
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-outline-variant/60 bg-surface-container-lowest p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {reportSuccess && (
                <p role="status" className="flex items-center gap-2 rounded-lg bg-tertiary-fixed px-3 py-2 text-xs font-semibold text-on-tertiary-fixed-variant">
                  <Icon icon="check_circle" size={16} fill className="shrink-0" />
                  Report filed — command review initiated.
                </p>
              )}
              {deleteProfileError && (
                <p role="alert" className="w-full rounded-lg bg-error-container px-3 py-2 text-left text-xs font-semibold text-on-error-container">
                  {deleteProfileError}
                </p>
              )}
              {tempPassword && (
                <div className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">New temporary password</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-sm font-extrabold text-primary">{tempPassword}</code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(tempPassword)}
                      className="shrink-0 rounded-md bg-primary-fixed px-2.5 py-1 text-xs font-bold text-on-primary-fixed hover:bg-primary-container hover:text-on-primary"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-on-surface-variant">Shown once — share it securely. The user must change it at next sign-in.</p>
                </div>
              )}
              <button
                onClick={() => setSelectedProfile(null)}
                className="w-full px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-semibold hover:bg-surface-container-high cursor-pointer"
              >
                Close
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void openReportModal()}
                  className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant font-bold text-xs hover:bg-secondary-fixed/70 cursor-pointer"
                >
                  <Icon icon="report_problem" size={15} />
                  Report
                </button>
                {!selectedProfile.id.startsWith('attendance-') && (
                  <button
                    type="button"
                    onClick={() => void handleResetPassword()}
                    disabled={resettingPassword}
                    className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg bg-surface-container-high text-on-surface font-bold text-xs hover:bg-surface-container-highest cursor-pointer disabled:opacity-60"
                  >
                    {resettingPassword ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="key" size={15} />}
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setDeleteProfileError(null); setConfirmDeleteProfile(true); }}
                  disabled={deletingProfile}
                  className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg bg-error-container text-on-error-container font-bold text-xs hover:bg-error-container/80 cursor-pointer disabled:opacity-60"
                >
                  {deletingProfile ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="delete" size={15} />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
      {selectedProfile && confirmDeleteProfile && (
        <EventDeleteDialog
          title={`Delete ${selectedProfile.full_name}?`}
          description="They will be removed from the roster and event lists, and their personnel account will be suspended."
          deleting={deletingProfile}
          error={deleteProfileError ?? undefined}
          cancelLabel="Keep profile"
          confirmLabel="Delete profile"
          pendingLabel="Deleting profile…"
          onCancel={() => {
            if (deletingProfile) return;
            setConfirmDeleteProfile(false);
            setDeleteProfileError(null);
          }}
          onConfirm={() => void handleDeleteProfile()}
        />
      )}

      {/* Personnel report modal */}
      {portalReady && reportOpen && createPortal((
        <div className="overlay-enter fixed inset-0 z-[60] flex items-center justify-center bg-surface-container/40 p-3 backdrop-blur-xs sm:p-4">
          <div className="overlay-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <div className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <div className="flex items-center gap-2">
                <Icon icon="edit_document" size={20} className="text-on-primary" />
                <h3 className="font-bold text-sm">File Personnel Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Close report form"
                className="rounded p-1 text-on-primary hover:bg-white/10 cursor-pointer"
              >
                <Icon icon="close" size={20} />
              </button>
            </div>

            <form onSubmit={(e) => void submitPersonnelReport(e)} className="flex flex-col gap-4 overflow-y-auto p-5 text-xs">
              <div className="rounded-lg bg-primary-fixed p-3 text-xs text-on-primary-fixed">
                <strong>{reportTarget?.name ?? selectedProfile?.full_name}</strong>
                <span className="mt-0.5 block font-mono text-on-primary-fixed/80">
                  HG Code: {reportTarget?.code || selectedProfile?.personnel_id || '—'}
                </span>
              </div>

              <div>
                <label htmlFor="admin-report-category" className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Report Category
                </label>
                <select
                  id="admin-report-category"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
                >
                  <option value="attendance">Late / Absent from Duty</option>
                  <option value="conduct">Conduct or Insubordination</option>
                  <option value="safety">Safety Concern</option>
                  <option value="other">Other Disciplinary Concern</option>
                </select>
              </div>

              <div>
                <label htmlFor="admin-report-description" className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Incident Description
                </label>
                <textarea
                  id="admin-report-description"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the incident or reason for filing this report..."
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <EventNameAutocomplete
                divisionId={reportTarget?.divisionId ?? null}
                value={reportEventName}
                onChange={setReportEventName}
                onSelect={(event) => setReportEventDate(event.event_date)}
                inputClassName="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface"
                labelClassName="block text-xs font-bold text-on-surface-variant"
              />
              <label className="block text-xs font-bold text-on-surface-variant">
                Event date
                <input required type="date" value={reportEventDate} onChange={(event) => setReportEventDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface" />
              </label>

              <div>
                <span className="mb-1 block text-xs font-bold text-on-surface-variant">
                  Memo photo <span className="text-error">(required)</span>
                </span>
                {reportPhoto ? (
                  <div className="flex items-center gap-2.5 rounded-lg bg-surface-container-low p-2">
                    <img src={reportPhoto} alt="Report memo" className="h-14 w-20 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-xs font-bold text-primary">
                        <Icon icon="verified" size={14} className="shrink-0 text-tertiary" />
                        Memo attached
                      </p>
                      <button type="button" onClick={() => setReportPhoto(null)} className="mt-0.5 text-[11px] font-bold text-error hover:underline">
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-xs font-bold text-primary transition-colors hover:bg-surface-container ${compressingPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                      {compressingPhoto ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="photo_camera" size={18} />}
                      {compressingPhoto ? 'Processing photo…' : 'Take memo photo'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void attachReportPhoto(e)} disabled={compressingPhoto} />
                    </label>
                    <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-3 text-xs font-bold text-primary transition-colors hover:bg-surface-container ${compressingPhoto ? 'pointer-events-none opacity-60' : ''}`}>
                      <Icon icon="add_photo_alternate" size={18} />
                      Choose from gallery
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void attachReportPhoto(e)} disabled={compressingPhoto} />
                    </label>
                  </div>
                )}
              </div>

              {reportError && (
                <p className="rounded-lg bg-error-container px-3 py-2 text-xs font-semibold text-on-error-container">
                  {reportError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-outline-variant pt-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="cursor-pointer rounded-lg bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportTarget || reportDescription.trim().length < 10 || !reportEventName.trim() || !reportEventDate || !reportPhoto}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingReport ? <Icon icon="sync" size={18} className="animate-spin" /> : <Icon icon="send" size={18} />}
                  <span>{submittingReport ? 'Filing…' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Add Personnel Modal */}
      {showAddModal && (
        <div className="overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-surface-container/40 p-4 backdrop-blur-xs">
          <div className="overlay-panel flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
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
                    <label className="font-bold text-on-surface-variant block mb-1">Home Guard type</label>
                    <select
                      value={newGuard.personnel_id.startsWith('WHG') ? 'WHG' : 'HG'}
                      onChange={(e) => {
                        const prefix = e.target.value;
                        const current = newGuard.personnel_id.replace(/^(WHG|HG)/i, '');
                        setNewGuard({ ...newGuard, personnel_id: `${prefix}${current}` });
                      }}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"
                    >
                      <option value="HG">Male Home Guard (HG)</option>
                      <option value="WHG">Women Home Guard (WHG)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Date of birth</label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      value={newGuard.date_of_birth}
                      onChange={(e) => setNewGuard({ ...newGuard, date_of_birth: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Joining date</label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      value={newGuard.joining_date}
                      onChange={(e) => setNewGuard({ ...newGuard, joining_date: e.target.value })}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">Home Guard code</label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={newGuard.personnel_id}
                      onChange={(e) => {
                        const prefix = newGuard.personnel_id.startsWith('WHG') ? 'WHG' : 'HG';
                        const suffix = e.target.value.toUpperCase().replace(/^(WHG|HG)/, '');
                        setNewGuard({ ...newGuard, personnel_id: `${prefix}${suffix}` });
                      }}
                      pattern="(HG|WHG)[A-Z0-9-]+"
                      title="Use HG for male Home Guards or WHG for women Home Guards, followed by the code number."
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-on-surface uppercase"
                      placeholder="HG12345"
                    />
                    <p className="mt-1 text-[11px] text-on-surface-variant">HG = male · WHG = women Home Guard</p>
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
 * Muster-register block inside the profile: current duty count and clickable event dates.
 * The register is looked up lazily when a profile opens, keyed on the mobile
 * number, because `profiles` and the roster have no shared id.
 */
function DutyHistorySection({ phone }: { phone?: string | null }) {
  const router = useRouter();
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showHistory, setShowHistory] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [datesError, setDatesError] = useState('');

  async function loadHistory() {
    const result = await loadGuardDutyHistory(phone);
    setHistory(result);
    setDateOfBirth(result?.dateOfBirth ?? '');
    setJoiningDate(result?.joiningDate ?? '');
    setState('ready');
  }

  useEffect(() => {
    let live = true;
    setState('loading');
    setShowHistory(false);
    setEditingDates(false);
    loadGuardDutyHistory(phone)
      .then((result) => {
        if (!live) return;
        setHistory(result);
        setDateOfBirth(result?.dateOfBirth ?? '');
        setJoiningDate(result?.joiningDate ?? '');
        setState('ready');
      })
      .catch(() => {
        if (live) setState('error');
      });
    return () => {
      live = false;
    };
  }, [phone]);

  async function submitDates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!history) return;
    setSavingDates(true);
    setDatesError('');
    try {
      await saveGuardProfileDates(history.guardId, dateOfBirth, joiningDate);
      await loadHistory();
      setEditingDates(false);
    } catch (reason) {
      setDatesError(reason instanceof Error ? reason.message : 'Could not save Home Guard dates.');
    } finally {
      setSavingDates(false);
    }
  }

  function closeDateEditor() {
    if (savingDates) return;
    setEditingDates(false);
    setDatesError('');
    setDateOfBirth(history?.dateOfBirth ?? '');
    setJoiningDate(history?.joiningDate ?? '');
  }

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
              <span className="text-[13px] font-semibold text-on-surface-variant">Date of birth</span>
              <span className="text-[13px] font-semibold text-on-surface">{formatProfileDate(history.dateOfBirth)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface-variant">Joining date</span>
              <span className="text-[13px] font-semibold text-on-surface">{formatProfileDate(history.joiningDate)}</span>
            </div>
            <button
              type="button"
              onClick={() => { setDatesError(''); setEditingDates(true); }}
              className="self-end text-xs font-semibold text-primary underline underline-offset-2"
            >
              Edit dates
            </button>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface-variant">
                Duties this month{history.divisionName ? ` · ${history.divisionName}` : ''}
              </span>
              <span className="text-lg font-extrabold text-primary tabular-nums">
                {history.months[0]?.present ?? 0}
              </span>
            </div>
          </div>
          <div className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-primary font-bold text-sm hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <Icon icon="history" size={18} />
              <span>View event dates</span>
            </button>
          </div>
        </>
      )}
      {showHistory && history && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHistory(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="profile-event-dates-title" className="overlay-panel flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="profile-event-dates-title" className="font-bold">Home Guard event dates</h2>
              <button type="button" onClick={() => setShowHistory(false)} aria-label="Close event dates" className="rounded p-1 hover:bg-white/10">
                <Icon icon="close" size={20} />
              </button>
            </header>
            {history.events.length ? (
              <ul className="divide-y divide-outline-variant overflow-y-auto overscroll-contain p-4">
                {history.events.map((event) => (
                  <li key={`${event.date}-${event.eventId ?? 'legacy'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHistory(false);
                        router.push(`/admin/events/${attendanceEventId(history.divisionId, event.date, event.eventId)}`);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md py-3 text-left text-[13px] hover:bg-surface-container-low"
                    >
                      <span className="font-semibold text-primary underline underline-offset-2">
                        {formatProfileDate(event.date)}
                        {event.eventName ? ` · ${event.eventName}` : ''}
                      </span>
                      <span className={event.status === 'present' ? 'shrink-0 text-on-tertiary-container' : 'shrink-0 text-error'}>
                        {event.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-center text-sm text-on-surface-variant">No event dates recorded.</p>
            )}
            <footer className="shrink-0 border-t border-outline-variant p-3">
              <button type="button" onClick={() => setShowHistory(false)} className="min-h-10 w-full rounded-lg bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">
                Close
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
      {editingDates && history && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[100] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDateEditor(); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="edit-home-guard-dates-title" className="overlay-panel w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="edit-home-guard-dates-title" className="font-bold">Edit Home Guard dates</h2>
              <button type="button" onClick={closeDateEditor} disabled={savingDates} aria-label="Close date editor" className="rounded p-1 hover:bg-white/10 disabled:opacity-50">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <form onSubmit={(event) => void submitDates(event)} className="space-y-4 p-4">
              <label className="block text-sm font-semibold text-on-surface-variant">
                Date of birth
                <input
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                />
              </label>
              <label className="block text-sm font-semibold text-on-surface-variant">
                Joining date
                <input
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  min={dateOfBirth || undefined}
                  value={joiningDate}
                  onChange={(event) => setJoiningDate(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                />
              </label>
              {datesError && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{datesError}</p>}
              <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
                <button type="button" onClick={closeDateEditor} disabled={savingDates} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingDates || !dateOfBirth || !joiningDate} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50">
                  {savingDates ? 'Saving dates…' : 'Save dates'}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

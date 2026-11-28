'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  listPersonnel,
  resetStaffPassword,
  setAccountStatus,
} from '@/lib/services/personnelService';
import { listDistricts } from '@/lib/services/referenceService';
import { addRosterGuard, attendanceEventId, compressImage, deactivateHomeGuard, filePersonnelReport, listDivisionRoster, loadGuardDutyHistory, saveGuardProfileDetails, type GuardDutyHistory, type RosterGuard } from '@/lib/services/simpleAttendanceService';
import { useLiveQuery } from '@/lib/hooks/useLiveQuery';
import { District, Profile } from '@/types';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { useDivision } from '@/lib/attendance/divisionContext';
import { EventNameAutocomplete } from '@/components/reports/EventNameAutocomplete';
import { GuardPersonnelMemos } from '@/components/attendance/GuardPersonnelMemos';
import { EventDeleteDialog } from '@/components/attendance/EventDeleteDialog';
import { MemoAttachmentField } from '@/components/reports/MemoAttachmentField';
import { prepareMemoAttachment } from '@/lib/utils/prepareMemoAttachment';
import { HomeGuardExcelImport } from '@/components/admin/HomeGuardExcelImport';

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

function formatDutyMonth(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatProfilePhone(phone: string | null | undefined) {
  return (phone ?? '').replace(/\D/g, '').slice(-10);
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

function PersonnelDirectoryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile');
  const { divisionId, setDivisionId, resolved: divisionResolved } = useDivision();
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('scope-error');
  const [divisionFilterReady, setDivisionFilterReady] = useState(false);
  const [districtScopeError, setDistrictScopeError] = useState<string | null>(null);
  const [selectedProfileState, setSelectedProfile] = useState<Profile | null>(null);
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
  const [reportDocument, setReportDocument] = useState<string | null>(null);
  const [compressingPhoto, setCompressingPhoto] = useState(false);
  const [memoCounts, setMemoCounts] = useState<Record<string, number>>({});
  const [memoCountsError, setMemoCountsError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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
  const selectedProfile = profileId
    ? selectedProfileState?.id === profileId
      ? selectedProfileState
      : personnel.find((profile) => profile.id === profileId) ?? null
    : null;

  function openProfile(profile: Profile) {
    setReportSuccess(false);
    setDeleteProfileError(null);
    setTempPassword(null);
    setSelectedProfile(profile);
    router.push(`${pathname}?profile=${encodeURIComponent(profile.id)}`, { scroll: false });
  }

  function closeProfile() {
    setSelectedProfile(null);
    setConfirmDeleteProfile(false);
    router.replace(pathname, { scroll: false });
  }

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const loadMemoCounts = async () => {
      try {
        const [legacyReports, personnelReports] = await Promise.all([
          supabase.from('guard_reports').select('subject_id'),
          supabase.from('personnel_reports').select('home_guard_code'),
        ]);
        if (!live) return;
        const queryError = legacyReports.error ?? personnelReports.error;
        if (queryError) {
          console.error('Could not load personnel memo counts:', queryError);
          setMemoCountsError(queryError.message);
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
        setMemoCountsError(null);
      } catch (error) {
        if (!live) return;
        console.error('Could not load personnel memo counts:', error);
        setMemoCountsError(error instanceof Error ? error.message : 'The memo counts could not be loaded.');
      }
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
    void (async () => {
      try {
        const { error } = await supabase.from('home_guard_roster').upsert(
          legacyGuards.map((profile) => ({
            division_id: divisionId,
            full_name: profile.full_name,
            phone: profile.phone!,
            home_guard_code: profile.personnel_id!,
            is_active: true,
          })),
          { onConflict: 'home_guard_code' },
        );
        if (error) {
          setRosterSyncError(`Existing Home Guards could not be added to the event roster: ${error.message}`);
        } else {
          setRosterSyncError(null);
          void attendanceRosterQuery.refresh();
        }
      } catch (error) {
        console.error('Could not sync existing Home Guards to the event roster:', error);
        setRosterSyncError('Existing Home Guards could not be added to the event roster. Please refresh and try again.');
      }
    })();
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

  // Password reset state (shown once on the profile page)
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
      closeProfile();
      void rosterQuery.refresh();
      void attendanceRosterQuery.refresh();
    } catch (error) {
      setDeleteProfileError(error instanceof Error ? error.message : 'The profile could not be deleted.');
    } finally {
      setDeletingProfile(false);
    }
  }

  async function processReportPhoto(file: File) {
    if (!file) return;
    setCompressingPhoto(true);
    setReportError(null);
    try {
      const attachment = await prepareMemoAttachment(file);
      setReportPhoto(attachment.photo);
      setReportDocument(attachment.document);
    } catch {
      setReportError('Could not prepare the memo image and PDF. Please try another photo.');
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
    setReportDocument(null);
    setReportError(null);
    setReportSuccess(false);
    const code = selectedProfile.personnel_id || '';
    try {
      const supabase = createClient();
      const { data: rosterGuard, error } = code
        ? await supabase.from('home_guard_roster').select('id, division_id').eq('home_guard_code', code).maybeSingle()
        : { data: null, error: null };
      if (error) throw new Error(error.message);
      setReportTarget(rosterGuard
        ? { guardId: rosterGuard.id, divisionId: rosterGuard.division_id, name: selectedProfile.full_name, code }
        : null);
      if (!rosterGuard) {
        setReportError('This person is not in the attendance roster, so a report cannot be filed against them.');
      }
    } catch (error) {
      console.error('Could not load the Home Guard report target:', error);
      setReportTarget(null);
      setReportError(error instanceof Error ? error.message : 'Could not load the Home Guard for this report.');
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
        evidenceDocument: reportDocument ?? undefined,
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
      setReportDocument(null);
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
      title={profileId ? 'Home Guard Profile' : 'Personnel Directory & Roster'}
      subtitle={profileId && selectedProfile
        ? selectedProfile.district?.name || 'Home Guard profile'
        : selectedDistrict ? `Tamil Nadu Home Guards • ${selectedDistrict.name}` : 'Tamil Nadu Home Guards • Selected district'}
    >
      <div className="flex flex-col gap-6 max-w-7xl mx-auto xl:max-w-none">
        {rosterSyncError && (
          <div role="alert" className="rounded-lg bg-error-container p-4 text-sm text-on-error-container">
            {rosterSyncError}
          </div>
        )}
        {profileId ? (
          selectedProfile ? (
            <section className="mx-auto w-full max-w-5xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeProfile}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-surface-container"
                >
                  <Icon icon="arrow_back" size={18} />
                  Back to guards
                </button>
                <span className="text-xs font-semibold text-on-surface-variant">Home Guard profile</span>
              </div>

              <GuardProfileSections
                profile={selectedProfile}
                districts={districts}
                memoCount={memoCounts[selectedProfile.id] ?? 0}
                memoCountsError={memoCountsError}
                guardId={attendanceRosterQuery.data?.find(
                  (guard) => guard.home_guard_code.toUpperCase() === selectedProfile.personnel_id?.toUpperCase(),
                )?.id ?? null}
                onMemoNavigate={() => setSelectedProfile(null)}
                onProfileUpdated={(details) => {
                  setSelectedProfile({
                    ...selectedProfile,
                    full_name: details.fullName,
                    phone: details.phone,
                    personnel_id: details.homeGuardCode,
                    district_id: details.districtId,
                    district: districts.find((district) => district.id === details.districtId) ?? null,
                  });
                  void rosterQuery.refresh();
                  void attendanceRosterQuery.refresh();
                }}
              />

              <div className="mt-3 space-y-2">
                {reportSuccess && (
                  <p role="status" className="rounded-lg bg-tertiary-fixed px-3 py-2 text-xs font-semibold text-on-tertiary-fixed-variant">
                    Report filed — command review initiated.
                  </p>
                )}
                {deleteProfileError && (
                  <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-xs font-semibold text-on-error-container">
                    {deleteProfileError}
                  </p>
                )}
                {tempPassword && (
                  <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">New temporary password</p>
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
                <div className={`grid gap-2 ${selectedProfile.id.startsWith('attendance-') ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  <button
                    type="button"
                    onClick={() => void openReportModal()}
                    className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-on-surface bg-secondary/20 px-1.5 text-[11px] font-bold text-on-secondary-fixed-variant hover:bg-secondary/25 sm:gap-1.5 sm:text-xs"
                  >
                    <Icon icon="report_problem" size={15} />
                    Report
                  </button>
                  {!selectedProfile.id.startsWith('attendance-') && (
                    <button
                      type="button"
                      onClick={() => void handleResetPassword()}
                      disabled={resettingPassword}
                      className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-surface-container-high px-1.5 text-[11px] font-bold text-on-surface hover:bg-surface-container-highest disabled:opacity-60 sm:gap-1.5 sm:text-xs"
                    >
                      {resettingPassword ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="key" size={15} />}
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setDeleteProfileError(null); setConfirmDeleteProfile(true); }}
                    disabled={deletingProfile}
                    className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-on-surface bg-error/20 px-1.5 text-[11px] font-bold text-on-error-container hover:bg-error/25 disabled:opacity-60 sm:gap-1.5 sm:text-xs"
                  >
                    {deletingProfile ? <Icon icon="sync" size={15} className="animate-spin" /> : <Icon icon="delete" size={15} />}
                    Delete
                  </button>
                </div>
              </div>
            </section>
          ) : rosterQuery.loading || attendanceRosterQuery.loading || !divisionFilterReady ? (
            <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
              Loading Home Guard profile…
            </p>
          ) : rosterQuery.error ? (
            <p role="alert" className="rounded-xl border border-outline-variant bg-error-container p-4 text-sm text-on-error-container">
              {rosterQuery.error}
            </p>
          ) : (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
              <p className="text-sm font-semibold text-on-surface">This Home Guard could not be found in the selected division.</p>
              <button type="button" onClick={closeProfile} className="mt-3 text-sm font-bold text-primary hover:underline">
                Back to guards
              </button>
            </div>
          )
        ) : (
          <>
        {/* Banner with Action Buttons */}
        <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Tamil Nadu Home Guards Directory</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              disabled={!divisionId || !selectedDistrict}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon="upload_file" size={16} />
              <span>Import Excel</span>
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
                    onClick={() => openProfile(p)}
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
          </>
        )}
      </div>

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
                <MemoAttachmentField
                  photo={reportPhoto}
                  document={reportDocument}
                  busy={compressingPhoto}
                  onAttach={processReportPhoto}
                  onRemove={() => { setReportPhoto(null); setReportDocument(null); }}
                />
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
                  disabled={submittingReport || compressingPhoto || !reportTarget || reportDescription.trim().length < 10 || !reportEventName.trim() || !reportEventDate || !reportPhoto || !reportDocument}
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

      {showImportModal && (
        <HomeGuardExcelImport
          divisionId={divisionId ?? ''}
          divisionName={selectedDistrict?.name ?? 'selected division'}
          onClose={() => setShowImportModal(false)}
          onImported={() => { void attendanceRosterQuery.refresh(); }}
        />
      )}

    </DashboardLayout>
  );
}

export default function PersonnelDirectoryPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-on-surface-variant">Loading personnel…</p>}>
      <PersonnelDirectoryContent />
    </Suspense>
  );
}

/**
 * Profile summary, dates, duty count, and memo cards for a Home Guard.
 */
function GuardProfileSections({
  profile,
  districts,
  memoCount,
  memoCountsError,
  guardId,
  onMemoNavigate,
  onProfileUpdated,
}: {
  profile: Profile;
  districts: District[];
  memoCount: number;
  memoCountsError: string | null;
  guardId: string | null;
  onMemoNavigate: () => void;
  onProfileUpdated: (details: {
    fullName: string;
    phone: string;
    homeGuardCode: string;
    districtId: string;
  }) => void;
}) {
  const router = useRouter();
  const phone = profile.phone;
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedDutyMonth, setSelectedDutyMonth] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileFullName, setProfileFullName] = useState(profile.full_name);
  const [profilePhone, setProfilePhone] = useState(formatProfilePhone(profile.phone));
  const [profileCode, setProfileCode] = useState(profile.personnel_id ?? '');
  const [profileDistrictId, setProfileDistrictId] = useState(profile.district_id ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState('');

  useEffect(() => {
    let live = true;
    setState('loading');
    setSelectedDutyMonth(0);
    setShowHistory(false);
    setEditingProfile(false);
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
  }, [phone, profile.district_id]);

  function openProfileEditor() {
    setProfileFullName(profile.full_name);
    setProfilePhone(formatProfilePhone(profile.phone));
    setProfileCode(profile.personnel_id ?? '');
    setProfileDistrictId(profile.district_id ?? districts.find(
      (district) => district.name === profile.district?.name,
    )?.id ?? '');
    setDateOfBirth(history?.dateOfBirth ?? '');
    setJoiningDate(history?.joiningDate ?? '');
    setProfileEditError('');
    setEditingProfile(true);
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!history) {
      setProfileEditError('This Home Guard is not linked to an attendance roster.');
      return;
    }
    const district = districts.find((item) => item.id === profileDistrictId);
    if (!district) {
      setProfileEditError('Select a valid division.');
      return;
    }

    setSavingProfile(true);
    setProfileEditError('');
    try {
      const { data: division, error: divisionError } = await createClient()
        .from('attendance_divisions')
        .select('id')
        .eq('code', district.code)
        .maybeSingle();
      if (divisionError || !division) {
        throw new Error(divisionError?.message ?? 'The selected division has no matching attendance roster.');
      }

      const homeGuardCode = profileCode.trim().toUpperCase();
      await saveGuardProfileDetails({
        guardId: history.guardId,
        profileId: profile.id.startsWith('attendance-') ? null : profile.id,
        fullName: profileFullName,
        phone: profilePhone,
        homeGuardCode,
        divisionId: division.id,
        districtId: district.id,
        dateOfBirth,
        joiningDate,
      });
      onProfileUpdated({
        fullName: profileFullName.trim(),
        phone: profilePhone.trim(),
        homeGuardCode,
        districtId: district.id,
      });
      setHistory((current) => current ? {
        ...current,
        homeGuardCode,
        dateOfBirth,
        joiningDate,
      } : current);
      setEditingProfile(false);
    } catch (reason) {
      setProfileEditError(reason instanceof Error ? reason.message : 'Could not save the Home Guard profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function closeProfileEditor() {
    if (savingProfile) return;
    setEditingProfile(false);
    setProfileEditError('');
  }

  return (
    <div className="space-y-3">
      <section className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xs sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-extrabold text-on-primary">
              {profile.full_name.charAt(0)}
            </div>
            <h2 className="min-w-0 break-words text-sm font-bold leading-tight text-on-surface sm:text-base">
              {profile.full_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={openProfileEditor}
            disabled={!history || state !== 'ready'}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-outline-variant px-2 text-[10px] font-bold text-primary hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs"
          >
            <Icon icon="edit" size={15} />
            Edit profile
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-outline-variant pt-3 sm:gap-x-5 sm:gap-y-3">
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Home Guard code</dt>
            <dd className="break-all font-mono text-[11px] font-semibold text-on-surface sm:text-xs">
              {profile.personnel_id || 'Not issued'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Division</dt>
            <dd className="break-words text-[11px] font-semibold text-on-surface sm:text-xs">
              {profile.district?.name || 'Not assigned'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Mobile</dt>
            <dd className="break-all text-[11px] font-semibold text-on-surface sm:text-xs">
              {profile.phone || 'Not provided'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Date of birth</dt>
            <dd className="text-[11px] font-semibold text-on-surface sm:text-xs">
              {state === 'loading' ? 'Loading…' : state === 'error' ? 'Unavailable' : formatProfileDate(history?.dateOfBirth)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Date of joining</dt>
            <dd className="text-[11px] font-semibold text-on-surface sm:text-xs">
              {state === 'loading' ? 'Loading…' : state === 'error' ? 'Unavailable' : formatProfileDate(history?.joiningDate)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <section className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xs sm:p-3">
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant sm:text-xs">Duties</h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedDutyMonth((month) => Math.min(month + 1, history?.months.length ?? month + 1))}
                disabled={!history || selectedDutyMonth >= history.months.length - 1}
                aria-label="Show previous month duty data"
                title="Show previous month"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="chevron_left" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDutyMonth((month) => Math.max(month - 1, 0))}
                disabled={selectedDutyMonth === 0}
                aria-label="Show next month duty data"
                title="Show next month"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="chevron_right" size={18} />
              </button>
            </div>
          </div>
          {state === 'loading' && (
            <p className="mt-2 text-[11px] text-on-surface-variant">Checking attendance…</p>
          )}
          {state === 'error' && (
            <p role="alert" className="mt-2 text-[11px] font-semibold text-on-error-container">
              Attendance could not be loaded.
            </p>
          )}
          {state === 'ready' && !history && (
            <p className="mt-2 text-[11px] text-on-surface-variant">Duty count unavailable.</p>
          )}
          {state === 'ready' && history && (
            <>
              <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
                {formatDutyMonth(history.months[selectedDutyMonth]?.month ?? history.months[0].month)}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <div className="min-w-0 rounded-md bg-surface-container-low p-1.5 text-center">
                  <p className="break-words text-[9px] font-semibold leading-tight text-on-surface-variant">Total duties</p>
                  <p className="mt-1 text-base font-extrabold text-primary tabular-nums">
                    {(history.months[selectedDutyMonth]?.present ?? 0) + (history.months[selectedDutyMonth]?.absent ?? 0)}
                  </p>
                </div>
                <div className="min-w-0 rounded-md bg-surface-container-low p-1.5 text-center">
                  <p className="break-words text-[9px] font-semibold leading-tight text-on-surface-variant">Present duties</p>
                  <p className="mt-1 text-base font-extrabold text-primary tabular-nums">
                    {history.months[selectedDutyMonth]?.present ?? 0}
                  </p>
                </div>
                <div className="min-w-0 rounded-md bg-surface-container-low p-1.5 text-center">
                  <p className="break-words text-[9px] font-semibold leading-tight text-on-surface-variant">Leave duties</p>
                  <p className="mt-1 text-base font-extrabold text-secondary tabular-nums">
                    {history.months[selectedDutyMonth]?.absent ?? 0}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-[10px] font-bold text-primary transition-colors hover:bg-surface-container-low sm:text-xs"
              >
                <Icon icon="history" size={16} />
                <span>Event dates</span>
              </button>
            </>
          )}
        </section>

        <section className="flex h-full min-w-0 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-xs sm:p-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant sm:text-xs">Memos</h3>
          {memoCountsError ? (
            <p role="alert" className="mt-2 break-words text-[10px] font-semibold text-on-error-container">
              Count unavailable.
            </p>
          ) : (
            <p className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">
              {memoCount}{' '}
              <span className="text-[10px] font-medium text-on-surface-variant sm:text-xs">
                {memoCount === 1 ? 'memo' : 'memos'}
              </span>
            </p>
          )}
          {memoCountsError && (
            <p className="mt-1 break-words text-[10px] text-on-error-container">{memoCountsError}</p>
          )}
          <div className="mt-auto pt-2">
            <GuardPersonnelMemos guardId={history?.guardId ?? guardId} onNavigate={onMemoNavigate} />
          </div>
        </section>
      </div>

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
      {editingProfile && history && createPortal(
        <div
          className="overlay-enter fixed inset-0 z-[100] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeProfileEditor(); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="edit-home-guard-profile-title" className="overlay-panel w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
            <header className="flex items-center justify-between bg-primary p-4 text-on-primary">
              <h2 id="edit-home-guard-profile-title" className="font-bold">Edit Home Guard profile</h2>
              <button type="button" onClick={closeProfileEditor} disabled={savingProfile} aria-label="Close profile editor" className="rounded p-1 hover:bg-white/10 disabled:opacity-50">
                <Icon icon="close" size={20} />
              </button>
            </header>
            <form onSubmit={(event) => void submitProfile(event)} className="max-h-[75dvh] space-y-3 overflow-y-auto p-4">
              <label className="block text-sm font-semibold text-on-surface-variant">
                Full name
                <input
                  type="text"
                  required
                  minLength={3}
                  value={profileFullName}
                  onChange={(event) => setProfileFullName(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                />
              </label>
              <label className="block text-sm font-semibold text-on-surface-variant">
                Home Guard code
                <input
                  type="text"
                  required
                  maxLength={40}
                  pattern="(HG|WHG)[A-Z0-9-]+"
                  value={profileCode}
                  onChange={(event) => setProfileCode(event.target.value.toUpperCase())}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm uppercase text-on-surface"
                />
              </label>
              <label className="block text-sm font-semibold text-on-surface-variant">
                Mobile number
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                />
              </label>
              <label className="block text-sm font-semibold text-on-surface-variant">
                Division
                <select
                  required
                  value={profileDistrictId}
                  onChange={(event) => setProfileDistrictId(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                >
                  <option value="">Select division</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))}
                </select>
              </label>
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
              {profileEditError && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{profileEditError}</p>}
              <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
                <button type="button" onClick={closeProfileEditor} disabled={savingProfile} className="min-h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingProfile || !dateOfBirth || !joiningDate} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50">
                  {savingProfile ? 'Saving profile…' : 'Save profile'}
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

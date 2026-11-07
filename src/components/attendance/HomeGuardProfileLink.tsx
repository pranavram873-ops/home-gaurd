'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { loadGuardDutyHistory, loadGuardMemoCount, type GuardDutyHistory } from '@/lib/services/simpleAttendanceService';
import { createClient } from '@/lib/supabase/client';

type GuardProfile = {
  id: string;
  full_name: string;
  phone: string;
  home_guard_code: string;
  division_name: string;
};

export function HomeGuardProfileLink({
  code,
  name,
  children,
  className,
}: {
  code: string | null | undefined;
  name: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [profile, setProfile] = useState<GuardProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function showProfile() {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: guard, error: guardError } = await supabase
        .from('home_guard_roster')
        .select('id, full_name, phone, home_guard_code, division_id')
        .eq('home_guard_code', code)
        .maybeSingle();
      if (guardError) throw new Error(guardError.message);
      if (!guard) throw new Error('This Home Guard is not in the active division roster.');

      const { data: division } = await supabase
        .from('attendance_divisions')
        .select('name')
        .eq('id', guard.division_id)
        .maybeSingle();
      setProfile({ ...guard, division_name: division?.name ?? 'Division not available' });
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this Home Guard profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {code ? (
        <button type="button" onClick={() => void showProfile()} disabled={loading} className={className}>
          {loading ? 'Loading profile…' : children ?? name}
        </button>
      ) : <span className={className}>{children ?? name}</span>}
      {error && (
        <span role="alert" className="ml-2 text-xs text-on-error-container">{error}</span>
      )}
      {open && profile && createPortal(
        <HomeGuardProfileDialog profile={profile} onClose={() => setOpen(false)} />,
        document.body,
      )}
    </>
  );
}

function HomeGuardProfileDialog({ profile, onClose }: { profile: GuardProfile; onClose: () => void }) {
  const [history, setHistory] = useState<GuardDutyHistory | null>(null);
  const [memoCount, setMemoCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      loadGuardDutyHistory(profile.phone),
      loadGuardMemoCount(profile.id, profile.phone),
    ]).then(([dutyHistory, memos]) => {
      if (!live) return;
      setHistory(dutyHistory);
      setMemoCount(memos);
    }).catch(() => {
      if (live) setHistory(null);
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, [profile]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-surface-container/50 p-4 backdrop-blur-xs" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="home-guard-profile-title" className="w-full max-w-sm overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
        <header className="flex items-center justify-between bg-primary p-4 text-on-primary">
          <div className="flex items-center gap-2"><Icon icon="badge" size={20} /><h2 id="home-guard-profile-title" className="font-bold">Home Guard Profile</h2></div>
          <button type="button" onClick={onClose} aria-label="Close profile" className="rounded p-1 hover:bg-white/10"><Icon icon="close" size={20} /></button>
        </header>
        <div className="flex flex-col items-center gap-4 p-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-on-primary">{profile.full_name.charAt(0)}</div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-on-surface">{profile.full_name}</h3>
            <p className="font-mono text-sm font-bold text-primary">{profile.home_guard_code}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{profile.division_name} Division</p>
            <p className="text-sm text-on-surface-variant">{profile.phone}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-xs font-semibold text-on-surface-variant">Duties this month</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{loading ? '…' : history?.months[0]?.present ?? 0}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3">
              <p className="text-xs font-semibold text-on-surface-variant">Memos on file</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{loading ? '…' : memoCount ?? 0}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 w-full rounded-lg bg-surface-container text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high">Close</button>
        </div>
      </section>
    </div>
  );
}

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { Profile, UserRole } from '@/types';
import { dataService, initialProfiles } from '@/lib/services/dataService';
import { createClient } from '@/lib/supabase/client';
import { isDemoModeEnabled } from '@/lib/supabase/env';
import { describeSignInError } from './errors';

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  /** True only for a deliberate local demo build; demo users are NOT authenticated. */
  demoMode: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  switchDemoRole: (newRole: UserRole) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// RLS policy "Users can view own profile" allows reading this row.
const PROFILE_SELECT = [
  'id', 'full_name', 'email', 'phone', 'personnel_id', 'role', 'district_id',
  'unit_id', 'account_status', 'rank_designation', 'avatar_url',
  'emergency_contact', 'blood_group', 'address', 'created_at', 'updated_at',
].join(', ');

async function loadProfile(userId: string): Promise<Profile | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as Profile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [demoMode] = useState(() => isDemoModeEnabled());
  // Guards against applying an async profile result after a newer one landed.
  const sessionRef = useRef<Session | null>(null);
  const sessionVersionRef = useRef(0);

  useEffect(() => {
    let active = true;

    if (demoMode) {
      const storedRole = getCookie('tnhg_demo_role') as UserRole | null;
      const storedUserId = getCookie('tnhg_demo_user_id');
      const profile =
        (storedRole && storedUserId && dataService.getPersonnelById(storedUserId)) || initialProfiles[0];

      console.warn(
        '[DEMO MODE] Auth bypassed — showing in-memory personnel "' +
          profile.full_name +
          '". This is NOT a real authenticated session.'
      );
      setUser(profile);
      setCookie('tnhg_demo_role', profile.role, 7);
      setCookie('tnhg_demo_user_id', profile.id, 7);
      setCookie('tnhg_demo_status', profile.account_status, 7);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    async function applySession(session: Session | null, version: number) {
      if (!active) return;
      if (version !== sessionVersionRef.current) return;

      if (!session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const profile = await loadProfile(session.user.id);
      if (!active || version !== sessionVersionRef.current) return;
      // The middleware also enforces this boundary server-side. Keep the client
      // context aligned so inactive accounts never appear signed in in the UI.
      setUser(profile?.account_status === 'active' ? profile : null);
      setIsLoading(false);
    }

    let unsubscribe: (() => void) | undefined;

    try {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const version = ++sessionVersionRef.current;
        sessionRef.current = nextSession;
        setIsLoading(true);

        // Supabase warns against making another Supabase request inside its auth
        // callback. Defer profile loading until the callback has returned.
        window.setTimeout(() => {
          void applySession(nextSession, version);
        }, 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data: sessionData }) => {
          // An auth event may have arrived while getSession was resolving.
          if (sessionVersionRef.current !== 0) return;
          const version = ++sessionVersionRef.current;
          sessionRef.current = sessionData.session;
          void applySession(sessionData.session, version);
        })
        .catch(() => {
          if (!active) return;
          setUser(null);
          setIsLoading(false);
        });
    } catch (err) {
      console.error('Supabase session initialisation failed:', err);
      setUser(null);
      setIsLoading(false);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [demoMode]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    if (demoMode) {
      return demoLogin(email);
    }

    if (!password) {
      setIsLoading(false);
      return { success: false, error: 'Enter your password to sign in.' };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: describeSignInError(error) };
      }

      const profile = data.session ? await loadProfile(data.session.user.id) : null;

      if (!profile) {
        // Authenticated but no personnel record (or RLS hid it): do not grant a session.
        await supabase.auth.signOut();
        return {
          success: false,
          error:
            'No personnel profile exists for this account yet. Contact Command HQ to complete your enrolment.',
        };
      }

      if (profile.account_status === 'pending') {
        await supabase.auth.signOut();
        return { success: false, error: 'Your registration is pending approval by the Area Commander.' };
      }

      if (profile.account_status === 'suspended' || profile.account_status === 'rejected') {
        await supabase.auth.signOut();
        return { success: false, error: 'This personnel account is currently suspended or inactive.' };
      }

      sessionRef.current = data.session;
      setUser(profile);
      // NOTE: writing the sign-in event to the real `audit_logs` table is a
      // separate increment; the in-memory log is demo data and is not written here.
      return { success: true, role: profile.role };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication service is unavailable.';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  function demoLogin(email: string): { success: boolean; error?: string; role?: UserRole } {
    const matched = dataService.getPersonnel().find((p) => p.email.toLowerCase() === email.toLowerCase().trim());
    if (!matched) {
      setIsLoading(false);
      return { success: false, error: 'DEMO MODE: no in-memory personnel matches that email.' };
    }
    if (matched.account_status !== 'active') {
      setIsLoading(false);
      return { success: false, error: 'DEMO MODE: this demo profile is not active.' };
    }
    setUser(matched);
    setCookie('tnhg_demo_role', matched.role, 7);
    setCookie('tnhg_demo_user_id', matched.id, 7);
    setCookie('tnhg_demo_status', matched.account_status, 7);
    setIsLoading(false);
    return { success: true, role: matched.role };
  }

  const logout = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore — session cookies are cleared below regardless
    }
    deleteCookie('tnhg_demo_role');
    deleteCookie('tnhg_demo_user_id');
    deleteCookie('tnhg_demo_status');
    sessionRef.current = null;
    setUser(null);
    setIsLoading(false);

    startTransition(() => {
      router.push('/login');
      router.refresh();
    });
  };

  const switchDemoRole = (newRole: UserRole) => {
    if (!demoMode) return; // real sessions must never be swapped client-side
    const targetUser = initialProfiles.find((p) => p.role === newRole && p.account_status === 'active');
    if (!targetUser) return;

    setUser(targetUser);
    setCookie('tnhg_demo_role', targetUser.role, 7);
    setCookie('tnhg_demo_user_id', targetUser.id, 7);
    setCookie('tnhg_demo_status', targetUser.account_status, 7);

    startTransition(() => {
      if (newRole === 'admin') router.push('/admin/dashboard');
      else router.push('/homeguard/dashboard');
      router.refresh();
    });
  };

  const refreshUser = () => {
    if (demoMode) {
      if (user?.id) {
        const updated = dataService.getPersonnelById(user.id);
        if (updated) setUser(updated);
      }
      return;
    }
    const userId = sessionRef.current?.user.id ?? user?.id;
    if (!userId) return;
    void loadProfile(userId).then((profile) => {
      if (profile) setUser(profile);
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        demoMode,
        login,
        logout,
        switchDemoRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Client cookie helper utilities (demo mode only)
function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

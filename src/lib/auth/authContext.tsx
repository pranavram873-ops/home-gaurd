'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { Profile, UserRole } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { describeSignInError } from './errors';

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// RLS policy "Users can view own profile" allows reading this row.
// The district and unit are embedded by their foreign-key constraint names: an
// unhinted join between the same pair of tables is refused by PostgREST, and
// every screen that shows a guard's command reads these off the session.
const PROFILE_SELECT = [
  'id', 'full_name', 'email', 'phone', 'personnel_id', 'role', 'district_id',
  'unit_id', 'account_status', 'rank_designation', 'avatar_url',
  'emergency_contact', 'blood_group', 'address', 'created_at', 'updated_at',
  'district:districts!profiles_district_id_fkey ( id, name, code )',
  'unit:units!profiles_unit_id_fkey ( id, name, code )',
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
  // Guards against applying an async profile result after a newer one landed.
  const sessionRef = useRef<Session | null>(null);
  const sessionVersionRef = useRef(0);

  useEffect(() => {
    let active = true;

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
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

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
        return {
          success: false,
          error: 'Your enrolment is pending approval by Command Headquarters.',
        };
      }

      if (profile.account_status === 'suspended' || profile.account_status === 'rejected') {
        await supabase.auth.signOut();
        return { success: false, error: 'This personnel account is currently suspended or inactive.' };
      }

      sessionRef.current = data.session;
      setUser(profile);
      // Signing in is not an audited action: the trail holds the operational
      // decisions (approvals, deployments, task and event changes) a command
      // enquiry is actually answered from.
      return { success: true, role: profile.role };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication service is unavailable.';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore — session cookies are cleared below regardless
    }
    sessionRef.current = null;
    setUser(null);
    setIsLoading(false);

    startTransition(() => {
      router.push('/login');
      router.refresh();
    });
  };

  const refreshUser = () => {
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
        login,
        logout,
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

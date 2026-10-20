'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Profile, UserRole } from '@/types';
import { dataService, initialProfiles } from '@/lib/services/dataService';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  login: (email: string, roleHint?: UserRole) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  switchDemoRole: (newRole: UserRole) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session from cookies or local storage
  useEffect(() => {
    async function initAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          const profile = dataService.getPersonnelById(authUser.id);
          if (profile) {
            setUser(profile);
            setIsLoading(false);
            return;
          }
        }

        // Fallback to demo session cookie or default demo user
        const storedRole = getCookie('tnhg_demo_role') as UserRole | null;
        const storedUserId = getCookie('tnhg_demo_user_id');

        if (storedRole && storedUserId) {
          const profile = dataService.getPersonnelById(storedUserId);
          if (profile) {
            setUser(profile);
            setIsLoading(false);
            return;
          }
        }

        // Default demo user: Admin (Vijayakumar IPS) for initial presentation
        const defaultAdmin = initialProfiles[0];
        setUser(defaultAdmin);
        setCookie('tnhg_demo_role', defaultAdmin.role, 7);
        setCookie('tnhg_demo_user_id', defaultAdmin.id, 7);
      } catch (err) {
        console.error('Auth initialization error:', err);
        const defaultAdmin = initialProfiles[0];
        setUser(defaultAdmin);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, roleHint?: UserRole) => {
    setIsLoading(true);
    try {
      // Find matching profile in database / memory
      const allPersonnel = dataService.getPersonnel();
      let matched = allPersonnel.find((p) => p.email.toLowerCase() === email.toLowerCase());

      if (!matched && roleHint) {
        matched = allPersonnel.find((p) => p.role === roleHint);
      }

      if (!matched) {
        setIsLoading(false);
        return { success: false, error: 'No personnel record found for this credential. Check with Command HQ.' };
      }

      if (matched.account_status === 'pending') {
        setIsLoading(false);
        return { success: false, error: 'Your registration is pending approval by the Area Commander.' };
      }

      if (matched.account_status === 'suspended' || matched.account_status === 'rejected') {
        setIsLoading(false);
        return { success: false, error: 'This personnel account is currently suspended or inactive.' };
      }

      setUser(matched);
      setCookie('tnhg_demo_role', matched.role, 7);
      setCookie('tnhg_demo_user_id', matched.id, 7);
      setCookie('tnhg_demo_status', matched.account_status, 7);

      dataService.recordAuditLog({
        actor_id: matched.id,
        actor_email: matched.email,
        actor_role: matched.role,
        action: 'USER_LOGIN',
        target_type: 'auth',
        target_id: matched.id,
      });

      setIsLoading(false);
      return { success: true, role: matched.role };
    } catch (err: unknown) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    deleteCookie('tnhg_demo_role');
    deleteCookie('tnhg_demo_user_id');
    deleteCookie('tnhg_demo_status');
    setUser(null);
    setIsLoading(false);

    startTransition(() => {
      router.push('/login');
      router.refresh();
    });
  };

  const switchDemoRole = (newRole: UserRole) => {
    const targetUser = initialProfiles.find((p) => p.role === newRole && p.account_status === 'active');
    if (targetUser) {
      setUser(targetUser);
      setCookie('tnhg_demo_role', targetUser.role, 7);
      setCookie('tnhg_demo_user_id', targetUser.id, 7);
      setCookie('tnhg_demo_status', targetUser.account_status, 7);

      startTransition(() => {
        if (newRole === 'admin') router.push('/admin/dashboard');
        else router.push('/homeguard/dashboard');
        router.refresh();
      });
    }
  };

  const refreshUser = () => {
    if (user?.id) {
      const updated = dataService.getPersonnelById(user.id);
      if (updated) setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
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

// Client cookie helper utilities
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

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// The division an incharge last chose is a working context, not a record: it
// survives navigation and reloads, but nothing server-side depends on it.
const STORAGE_KEY = 'tnhg.selectedDivision';

interface DivisionContextValue {
  /** Empty until a choice is stored or a screen falls back to the first division. */
  divisionId: string;
  setDivisionId: (id: string) => void;
  /** False until the stored choice has been read back from localStorage. */
  resolved: boolean;
}

const DivisionContext = createContext<DivisionContextValue | null>(null);

export function DivisionProvider({ children }: { children: React.ReactNode }) {
  const [divisionId, setDivisionIdState] = useState('');
  const [resolved, setResolved] = useState(false);

  // Read after mount so the server render and the first client render agree.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setDivisionIdState(stored);
    } catch {
      // Private-mode storage failures only cost the memory, never the screen.
    } finally {
      setResolved(true);
    }
  }, []);

  const setDivisionId = useCallback((id: string) => {
    setDivisionIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ divisionId, setDivisionId, resolved }),
    [divisionId, setDivisionId, resolved],
  );
  return <DivisionContext.Provider value={value}>{children}</DivisionContext.Provider>;
}

export function useDivision(): DivisionContextValue {
  const context = useContext(DivisionContext);
  if (!context) throw new Error('useDivision must be used inside <DivisionProvider>.');
  return context;
}

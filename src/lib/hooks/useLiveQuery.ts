'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The shape both `ListResult<T>` and `OneResult<T>` from `queryError.ts` satisfy.
 * Callers pass the element type they expect, e.g. `useLiveQuery<District[]>(...)`
 * for a service returning `ListResult<District[]>`.
 */
type QueryResult<T> = { data: T | null; error: string | null };

/**
 * Load-on-mount, error surface, and manual refresh for a Supabase-backed screen.
 *
 * Every operational page used to read a synchronous in-memory array, which meant
 * there was no loading state, no error state, and no way to see a failed request.
 * This hook keeps those three consistent across the portal instead of each page
 * inventing its own.
 *
 * `reloadKey` re-runs the query when it changes (for example a selected district
 * on the registration form). The loader itself is held in a ref so an inline
 * arrow function at the call site does not cause an endless refetch.
 */
export function useLiveQuery<T>(
  loader: () => Promise<QueryResult<T>>,
  reloadKey?: unknown,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: (next: T) => void;
} {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (!mountedRef.current) return;
      setData(result.data ?? null);
      setError(result.error);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'The request failed.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh, reloadKey]);

  return { data, loading, error, refresh, setData };
}

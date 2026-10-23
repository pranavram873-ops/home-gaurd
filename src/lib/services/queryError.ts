import type { PostgrestError } from '@supabase/supabase-js';

/** Every service in this folder returns one of these two shapes. */
export interface ListResult<T> {
  data: T[];
  error: string | null;
}

export interface OneResult<T> {
  data: T | null;
  error: string | null;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error: string | null;
}

/**
 * Translate PostgREST and Postgres diagnostics into something an operator can
 * act on. The raw message is kept in front of the hint wherever it is the only
 * useful clue, because these strings are what a support screenshot shows.
 */
export function describeQueryError(
  error: PostgrestError | null | undefined,
  fallback = 'The request could not be completed.',
): string | null {
  if (!error) return null;
  const message = error.message || fallback;

  switch (error.code) {
    case '42501':
      return 'This account is not permitted to perform that action. Sign in with an account that holds the right role.';
    case 'PGRST202':
    case 'PGRST205':
      return `${message} — the database migrations may not be applied to this Supabase project yet.`;
    case '42P01':
      return `${message} — the table is not present in this Supabase project. Apply the migrations.`;
    case '42703':
      return `${message} — the application expects a column this project does not have. Re-apply the migrations.`;
    case 'PGRST201':
    case '42712':
      return `${message} — a join in this query needs its foreign-key hint and alias restored.`;
    case '23505':
      return 'That record already exists — a unique value such as an e-mail address or service badge number clashed.';
    case '23503':
      return 'A linked record no longer exists. Refresh the list and choose a current district, unit, duty post or officer.';
    case '23514':
      return 'The database rejected one of the values. Check the status, priority and date fields against the allowed options.';
    default:
      return message;
  }
}

/** For exceptions thrown by the transport layer rather than returned by Postgres. */
export function describeThrownError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (/fetch failed|Failed to fetch|NetworkError|ENOTFOUND/i.test(err.message)) {
      return 'The Supabase API is unreachable. Check the project URL and your network connection.';
    }
    return err.message;
  }
  return fallback;
}

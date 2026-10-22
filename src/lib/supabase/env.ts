// Central Supabase / application environment resolution.
//
// Naming note: this project's Vercel-managed Supabase integration injects
// `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
// `SUPABASE_SECRET_KEY` plus the legacy `SUPABASE_ANON_KEY` /
// `SUPABASE_SERVICE_ROLE_KEY`. Only `NEXT_PUBLIC_*` variables are inlined into
// the browser bundle, so the publishable key is resolved public-first: that
// keeps the browser and the server using the *same* key (mixing a legacy anon
// key on the server with a new publishable key in the browser is a common
// source of confusing session bugs).
//
// The publishable (anon) key is browser-safe: Row Level Security still applies.
// Secret / service-role keys must never be read from client code — see admin.ts.

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  );
}

export function getSupabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  );
}

// True only when a real (non-placeholder) project is wired up.
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return (
    url.startsWith('https://') &&
    url.includes('.supabase.') &&
    !key.includes('dummy') &&
    !key.includes('your-anon-key') &&
    !key.includes('your-publishable-key') &&
    key.length > 20
  );
}

export function getAppUrl(): string {
  // Trailing slash is stripped: callers append '/login' or '/reset-password', and
  // a doubled slash would not match Supabase's Redirect URLs allow-list.
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
}

// Deliberate, opt-in local demo mode. Never available in a production build:
// demo identities are not authenticated and must not be reachable there.
export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

// Public enlistment switch (defaults to enabled).
export function isPublicRegistrationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION !== 'false';
}

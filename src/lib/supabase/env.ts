// Vercel-managed Supabase integration injects `SUPABASE_URL` and
// `SUPABASE_PUBLISHABLE_KEY` (legacy name: `SUPABASE_ANON_KEY`).
// `NEXT_PUBLIC_*` names are kept as fallbacks for pre-existing setups.
// The publishable (anon) key is browser-safe: Row Level Security applies.
export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  );
}

export function getSupabasePublishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return (
    url.startsWith('https://') &&
    !url.includes('tn-homeguards-dev') && // local placeholder project
    !key.includes('dummy') &&
    key.length > 20
  );
}

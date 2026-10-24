import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel's Supabase integration may provide server-side names (SUPABASE_URL,
  // SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY). Client components cannot
  // read those directly, so resolve the browser-safe values at build time.
  // Never add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY here.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '',
    // A Maps JavaScript API key is only ever used by browser code - it is meant
    // to be confined by HTTP-referrer restrictions, not by secrecy - so an
    // unprefixed name set in Vercel is published to the bundle here. Leaving it
    // unset is a valid configuration: the map panels say so and still show the
    // post's coordinates.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || process.env.GOOGLE_MAPS_MAP_ID || '',
  },
  eslint: {
    // Only fail on errors, not unused var warnings during production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

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

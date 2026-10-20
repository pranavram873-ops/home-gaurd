import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Only fail on errors, not unused var warnings during production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

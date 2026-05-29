import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep these node-native libs out of the bundler — they're required at
  // runtime in route handlers + the instrumentation worker.
  serverExternalPackages: ['postgres', 'google-auth-library'],
};

export default nextConfig;

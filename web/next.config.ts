import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: webRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: webRoot },
  // Caps the stale-while-revalidate window on prerendered pages so shared caches
  // (including crawler caches) refresh public content within the hour.
  expireTime: 3600,
};

export default nextConfig;

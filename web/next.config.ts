import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: webRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: webRoot },
};

export default nextConfig;

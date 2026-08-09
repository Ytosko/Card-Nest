import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: webRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: webRoot },
  expireTime: 3600,
  async rewrites() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/well-known/assetlinks',
      },
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/well-known/apple-app-site-association',
      },
    ];
  },
};

export default nextConfig;

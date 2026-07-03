import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['casper-js-sdk', '@make-software/ces-js-parser'],
};

export default nextConfig;

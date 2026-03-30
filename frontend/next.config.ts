import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*weebdex.org',
      },
      {
        protocol: 'https',
        hostname: '*.weebdex.net',
      },
    ],
  },
};

export default nextConfig;

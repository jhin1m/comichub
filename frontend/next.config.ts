import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
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
      {
        protocol: 'https',
        hostname: '*.comix.to',
      },
    ],
  },
};

export default nextConfig;

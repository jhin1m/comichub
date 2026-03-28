import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // allowedDevOrigins: ['usb-wages-ada-radiation.trycloudflare.com'],
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
    ],
  },
};

export default nextConfig;

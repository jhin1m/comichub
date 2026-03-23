import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.s3.*.amazonaws.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'myanimelist.*' },
      { protocol: 'https', hostname: 'static.comix.to' },
    ],
  },
};

export default nextConfig;
